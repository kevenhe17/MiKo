from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import ChangeRequest, Project, User, ChangeLog
from ..machines import assert_cr_transition, available_cr_actions, IllegalCrTransitionError, ChangeStatus
from ..utils import ok, fail, paginate


bp = Blueprint("change_request", __name__)


def _serialize_cr(cr: ChangeRequest):
    return {
        "id": str(cr.id),
        "projectId": str(cr.project_id),
        "code": cr.code,
        "title": cr.title,
        "type": cr.type,
        "sourceType": cr.source_type,
        "sourceId": str(cr.source_id) if cr.source_id else None,
        "version": cr.version,
        "srcBranch": cr.src_branch,
        "dstBranch": cr.dst_branch,
        "riskLevel": cr.risk_level,
        "needRegression": cr.need_regression,
        "status": cr.status.value if hasattr(cr.status, "value") else cr.status,
        "ownerId": str(cr.owner_id),
        "reviewerId": str(cr.reviewer_id) if cr.reviewer_id else None,
        "backflowStatus": cr.backflow_status,
        "conflictFiles": cr.conflict_files,
        "rolledBack": cr.rolled_back,
        "mergedAt": cr.merged_at.isoformat() if cr.merged_at else None,
        "mergedBy": str(cr.merged_by) if cr.merged_by else None,
        "mergedSha": cr.merged_sha,
        "tag": cr.tag,
        "createdAt": cr.created_at.isoformat() if cr.created_at else None,
        "updatedAt": cr.updated_at.isoformat() if cr.updated_at else None,
        "owner": {
            "id": str(cr.owner.id),
            "username": cr.owner.username,
            "realname": cr.owner.realname,
        } if cr.owner else None,
        "reviewer": {
            "id": str(cr.reviewer.id),
            "username": cr.reviewer.username,
            "realname": cr.reviewer.realname,
        } if cr.reviewer else None,
        "merger": {
            "id": str(cr.merger.id),
            "username": cr.merger.username,
            "realname": cr.merger.realname,
        } if cr.merger else None,
    }


def _role_required(*roles):
    def decorator(fn):
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = getattr(request, "jwt", {}) or {}
            role = claims.get("role")
            if role not in roles:
                return jsonify(fail("权限不足", 40301)), 403
            return fn(*args, **kwargs)
        wrapper.__name__ = fn.__name__
        return wrapper
    return decorator


@bp.post("/changes")
@_role_required("DEV", "ADMIN")
def create_change():
    data = request.get_json(silent=True) or {}
    project_id = data.get("projectId")
    title = (data.get("title") or "").strip()
    change_type = data.get("type")
    source_type = data.get("sourceType")
    src_branch = (data.get("srcBranch") or "").strip()
    dst_branch = (data.get("dstBranch") or "").strip()
    if not project_id or not title or not change_type or not source_type or not src_branch or not dst_branch:
        return jsonify(fail("必填字段缺失", 40001)), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify(fail("所属项目不存在", 40401)), 404

    count = ChangeRequest.query.filter_by(project_id=int(project_id)).count()
    seq = str(count + 1).zfill(4)
    code = f"CR-{project.code}-{seq}"

    owner_id = int(get_jwt_identity())
    reviewer_id = data.get("reviewerId")
    if reviewer_id:
        reviewer = User.query.get(reviewer_id)
        if not reviewer:
            return jsonify(fail("评审人不存在", 40402)), 404
        if int(reviewer_id) == owner_id:
            return jsonify(fail("owner 与 reviewer 不能是同一个人", 40004)), 400

    backflow_status = None
    if change_type == "HOTFIX" or dst_branch.startswith("release/"):
        backflow_status = "PENDING"

    cr = ChangeRequest(
        project_id=int(project_id),
        code=code,
        title=title,
        type=change_type,
        source_type=source_type,
        source_id=int(data.get("sourceId")) if data.get("sourceId") else None,
        version=data.get("version"),
        src_branch=src_branch,
        dst_branch=dst_branch,
        risk_level=data.get("riskLevel", "MEDIUM"),
        need_regression=bool(data.get("needRegression", True)),
        status=ChangeStatus.DRAFT,
        owner_id=owner_id,
        reviewer_id=int(reviewer_id) if reviewer_id else None,
        backflow_status=backflow_status,
        conflict_files=data.get("conflictFiles"),
        rolled_back=False,
    )
    db.session.add(cr)
    db.session.commit()
    return jsonify(ok(_serialize_cr(cr))), 201


@bp.get("/changes")
@jwt_required()
def list_changes():
    project_id = request.args.get("projectId")
    status = request.args.get("status")
    change_type = request.args.get("type")
    source_type = request.args.get("sourceType")
    source_id = request.args.get("sourceId")
    owner_id = request.args.get("ownerId")
    page = max(1, int(request.args.get("page", 1) or 1))
    page_size = min(100, max(1, int(request.args.get("pageSize", 10) or 10)))

    query = ChangeRequest.query
    if project_id:
        query = query.filter_by(project_id=int(project_id))
    if status:
        query = query.filter_by(status=status)
    if change_type:
        query = query.filter_by(type=change_type)
    if source_type:
        query = query.filter_by(source_type=source_type)
    if source_id and str(source_id).isdigit():
        query = query.filter_by(source_id=int(source_id))
    if owner_id and str(owner_id).isdigit():
        query = query.filter_by(owner_id=int(owner_id))

    query = query.order_by(ChangeRequest.updated_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(ok(paginate([_serialize_cr(c) for c in items], total, page, page_size))), 200


@bp.get("/changes/<int:cr_id>")
@jwt_required()
def detail_change(cr_id: int):
    cr = ChangeRequest.query.get_or_404(cr_id)
    data = _serialize_cr(cr)
    logs = ChangeLog.query.filter_by(cr_id=cr.id).order_by(ChangeLog.created_at.desc()).all()
    data["logs"] = [
        {
            "id": str(l.id),
            "action": l.action,
            "fromStatus": l.from_status.value if hasattr(l.from_status, "value") else l.from_status,
            "toStatus": l.to_status.value if hasattr(l.to_status, "value") else l.to_status,
            "comment": l.comment,
            "operator": {
                "id": str(l.operator.id),
                "username": l.operator.username,
                "realname": l.operator.realname,
            } if l.operator else None,
            "createdAt": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
    data["availableActions"] = available_cr_actions(
        cr.status.value if hasattr(cr.status, "value") else cr.status,
        getattr(request, "jwt", {}).get("role", ""),
    )
    return jsonify(ok(data)), 200


def _transition_cr(cr_id: int, action: str, require_comment=False):
    cr = ChangeRequest.query.get_or_404(cr_id)
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    comment = data.get("comment") if data.get("comment") is not None else ""

    if require_comment and not comment:
        return jsonify(fail("该操作需要填写备注", 40003)), 400

    try:
        to_status = assert_cr_transition(
            cr.status.value if hasattr(cr.status, "value") else cr.status,
            action,
            role,
        )
    except IllegalCrTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    from_status = cr.status
    cr.status = to_status

    if action == "merge":
        cr.merged_at = __now()
        cr.merged_by = operator_id
        cr.merged_sha = data.get("mergedSha")
    elif action == "release":
        cr.tag = data.get("tag")

    if to_status == ChangeStatus.RELEASED and (cr.type == "HOTFIX" or cr.dst_branch.startswith("release/")):
        cr.backflow_status = "PENDING"

    db.session.add(ChangeLog(
        cr_id=cr.id,
        operator_id=operator_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
    ))
    db.session.commit()
    return jsonify(ok(_serialize_cr(cr))), 200


def __now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)


@bp.post("/changes/<int:cr_id>/submit")
@_role_required("DEV", "ADMIN")
def submit_change(cr_id: int):
    return _transition_cr(cr_id, "submit")


@bp.post("/changes/<int:cr_id>/approve")
@_role_required("DEV", "ADMIN")
def approve_change(cr_id: int):
    cr = ChangeRequest.query.get_or_404(cr_id)
    operator_id = int(get_jwt_identity())
    if cr.owner_id == operator_id:
        return jsonify(fail("owner 与 reviewer 不能是同一个人（两人原则）", 40005)), 400
    return _transition_cr(cr_id, "approve")


@bp.post("/changes/<int:cr_id>/reject-review")
@_role_required("DEV", "ADMIN")
def reject_review_change(cr_id: int):
    return _transition_cr(cr_id, "reject-review", require_comment=True)


@bp.post("/changes/<int:cr_id>/start-build")
@_role_required("ADMIN")
def start_build_change(cr_id: int):
    return _transition_cr(cr_id, "start-build")


@bp.post("/changes/<int:cr_id>/build-done")
@_role_required("ADMIN")
def build_done_change(cr_id: int):
    return _transition_cr(cr_id, "build-done")


@bp.post("/changes/<int:cr_id>/regression-done")
@_role_required("QA", "ADMIN")
def regression_done_change(cr_id: int):
    return _transition_cr(cr_id, "regression-done")


@bp.post("/changes/<int:cr_id>/gate-pass")
@_role_required("ADMIN")
def gate_pass_change(cr_id: int):
    return _transition_cr(cr_id, "gate-pass")


@bp.post("/changes/<int:cr_id>/merge")
@_role_required("ADMIN")
def merge_change(cr_id: int):
    return _transition_cr(cr_id, "merge")


@bp.post("/changes/<int:cr_id>/release")
@_role_required("ADMIN")
def release_change(cr_id: int):
    return _transition_cr(cr_id, "release")


@bp.post("/changes/<int:cr_id>/abandon")
@_role_required("DEV", "QA", "ADMIN")
def abandon_change(cr_id: int):
    return _transition_cr(cr_id, "abandon", require_comment=True)


@bp.post("/changes/<int:cr_id>/backflow-done")
@_role_required("ADMIN")
def backflow_done_change(cr_id: int):
    cr = ChangeRequest.query.get_or_404(cr_id)
    if cr.backflow_status != "PENDING":
        return jsonify(fail("当前变更单无需回流", 40006)), 400
    cr.backflow_status = "DONE"
    db.session.commit()
    return jsonify(ok(_serialize_cr(cr))), 200


@bp.get("/changes/stats/overview")
@jwt_required()
def stats_overview():
    project_id = request.args.get("projectId")
    query = ChangeRequest.query
    if project_id:
        query = query.filter_by(project_id=int(project_id))

    total = query.count()
    by_status = {}
    by_type = {}
    by_risk = {}
    merged_count = 0
    merge_hours_sum = 0
    merge_hours_count = 0
    pending_backflow = 0

    for cr in query.all():
        s = cr.status.value if hasattr(cr.status, "value") else cr.status
        by_status[s] = by_status.get(s, 0) + 1
        by_type[cr.type] = by_type.get(cr.type, 0) + 1
        by_risk[cr.risk_level] = by_risk.get(cr.risk_level, 0) + 1
        if cr.status == ChangeStatus.MERGED:
            merged_count += 1
            if cr.merged_at and cr.created_at:
                diff = cr.merged_at - cr.created_at
                hours = diff.total_seconds() / 3600
                merge_hours_sum += hours
                merge_hours_count += 1
        if cr.backflow_status == "PENDING":
            pending_backflow += 1

    avg_merge_hours = round(merge_hours_sum / merge_hours_count, 2) if merge_hours_count else 0

    return jsonify(ok({
        "total": total,
        "byStatus": by_status,
        "byType": by_type,
        "byRisk": by_risk,
        "avgMergeHours": avg_merge_hours,
        "mergedCount": merged_count,
        "pendingBackflow": pending_backflow,
    })), 200


@bp.get("/changes/stats/trend")
@jwt_required()
def stats_trend():
    project_id = request.args.get("projectId")
    days = min(60, max(1, int(request.args.get("days", 14) or 14)))
    from datetime import datetime, timedelta, timezone

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    query = ChangeRequest.query.filter(ChangeRequest.created_at >= start)
    if project_id:
        query = query.filter_by(project_id=int(project_id))

    created_map = {}
    for cr in query.all():
        day = cr.created_at.strftime("%Y-%m-%d")
        created_map[day] = created_map.get(day, 0) + 1

    log_query = ChangeLog.query.filter(ChangeLog.created_at >= start)
    if project_id:
        log_query = log_query.join(ChangeRequest).filter(ChangeRequest.project_id == int(project_id))
    trans_map = {}
    for log in log_query.all():
        day = log.created_at.strftime("%Y-%m-%d")
        trans_map[day] = trans_map.get(day, 0) + 1

    series = []
    current = start
    while current <= end:
        day = current.strftime("%Y-%m-%d")
        series.append({
            "date": day,
            "created": created_map.get(day, 0),
            "transitions": trans_map.get(day, 0),
        })
        current += timedelta(days=1)

    return jsonify(ok({"days": days, "series": series})), 200


@bp.get("/changes/stats/backflow")
@jwt_required()
def stats_backflow():
    project_id = request.args.get("projectId")
    query = ChangeRequest.query.filter_by(backflow_status="PENDING")
    if project_id:
        query = query.filter_by(project_id=int(project_id))

    items = query.order_by(ChangeRequest.merged_at.desc().nullslast()).all()
    return jsonify(ok([
        {
            "id": str(cr.id),
            "code": cr.code,
            "title": cr.title,
            "type": cr.type,
            "status": cr.status.value if hasattr(cr.status, "value") else cr.status,
            "srcBranch": cr.src_branch,
            "dstBranch": cr.dst_branch,
            "mergedAt": cr.merged_at.isoformat() if cr.merged_at else None,
            "backflowStatus": cr.backflow_status,
            "owner": {
                "id": str(cr.owner.id),
                "username": cr.owner.username,
                "realname": cr.owner.realname,
            } if cr.owner else None,
        }
        for cr in items
    ])), 200
