from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Bug, User, Project, Requirement, TestCase, BugLog, Attachment
from ..machines import assert_bug_transition, IllegalTransitionError
from ..utils import ok, fail, paginate


bp = Blueprint("bug", __name__)


def _serialize_bug(bug: Bug):
    return {
        "id": str(bug.id),
        "projectId": str(bug.project_id),
        "code": bug.code,
        "title": bug.title,
        "severity": bug.severity.value if hasattr(bug.severity, "value") else bug.severity,
        "priority": bug.priority,
        "status": bug.status.value if hasattr(bug.status, "value") else bug.status,
        "module": bug.module,
        "environment": bug.environment,
        "steps": bug.steps,
        "expected": bug.expected,
        "actual": bug.actual,
        "ownerId": str(bug.owner_id) if bug.owner_id else None,
        "fixerId": str(bug.fixer_id) if bug.fixer_id else None,
        "rootCause": bug.root_cause,
        "fixDesc": bug.fix_desc,
        "impact": bug.impact,
        "requirementId": str(bug.requirement_id) if bug.requirement_id else None,
        "caseId": str(bug.case_id) if bug.case_id else None,
        "createdAt": bug.created_at.isoformat() if bug.created_at else None,
        "updatedAt": bug.updated_at.isoformat() if bug.updated_at else None,
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


def _get_identity():
    return get_jwt_identity()


@bp.post("/bugs")
@_role_required("QA", "ADMIN")
def create_bug():
    data = request.get_json(silent=True) or {}
    project_id = data.get("projectId")
    title = (data.get("title") or "").strip()
    severity = data.get("severity")
    module = (data.get("module") or "").strip()
    steps = data.get("steps")
    expected = data.get("expected")
    actual = data.get("actual")
    if not project_id or not title or not severity or not module or not steps or not expected or not actual:
        return jsonify(fail("必填字段缺失", 40001)), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify(fail("所属项目不存在", 40401)), 404

    if data.get("requirementId"):
        req = Requirement.query.get(data.get("requirementId"))
        if not req or str(req.project_id) != str(project_id):
            return jsonify(fail("关联的需求不存在或不属于该项目", 40002)), 400

    if data.get("caseId"):
        tc = TestCase.query.get(data.get("caseId"))
        if not tc or str(tc.project_id) != str(project_id):
            return jsonify(fail("关联的用例不存在或不属于该项目", 40003)), 400

    count = Bug.query.filter_by(project_id=int(project_id)).count()
    seq = str(count + 1).zfill(4)
    code = f"BUG-{project.code}-{seq}"
    if Bug.query.filter_by(code=code).first():
        return jsonify(fail("Bug 编号生成冲突，请重试", 40901)), 409

    bug = Bug(
        project_id=int(project_id),
        code=code,
        title=title,
        severity=severity,
        priority=data.get("priority"),
        status="NEW",
        module=module,
        environment=data.get("environment"),
        steps=steps,
        expected=expected,
        actual=actual,
        owner_id=int(data.get("ownerId")) if data.get("ownerId") else None,
        fixer_id=None,
        root_cause=None,
        fix_desc=None,
        impact=None,
        requirement_id=int(data.get("requirementId")) if data.get("requirementId") else None,
        case_id=int(data.get("caseId")) if data.get("caseId") else None,
    )
    db.session.add(bug)
    db.session.commit()
    return jsonify(ok(_serialize_bug(bug))), 201


@bp.get("/bugs")
@jwt_required()
def list_bugs():
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    project_id = request.args.get("projectId")
    status = request.args.get("status")
    severity = request.args.get("severity")
    owner_id = request.args.get("ownerId")
    page = max(1, int(request.args.get("page", 1) or 1))
    page_size = min(100, max(1, int(request.args.get("pageSize", 10) or 10)))

    query = Bug.query
    if project_id:
        query = query.filter_by(project_id=int(project_id))
    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)
    if owner_id and str(owner_id).isdigit():
        query = query.filter_by(owner_id=int(owner_id))

    if role == "DEV":
        me = int(get_jwt_identity())
        query = query.filter((Bug.owner_id == me) | (Bug.fixer_id == me))

    query = query.order_by(Bug.updated_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(ok(paginate([_serialize_bug(b) for b in items], total, page, page_size))), 200


@bp.get("/bugs/<int:bug_id>")
@jwt_required()
def detail_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    data = _serialize_bug(bug)
    data["project"] = {
        "id": str(bug.project.id),
        "code": bug.project.code,
        "name": bug.project.name,
    } if bug.project else None
    data["owner"] = {
        "id": str(bug.owner.id),
        "username": bug.owner.username,
        "realname": bug.owner.realname,
    } if bug.owner else None
    data["fixer"] = {
        "id": str(bug.fixer.id),
        "username": bug.fixer.username,
        "realname": bug.fixer.realname,
    } if bug.fixer else None
    data["requirement"] = {
        "id": str(bug.requirement.id),
        "code": bug.requirement.code,
        "title": bug.requirement.title,
    } if bug.requirement else None
    data["case"] = {
        "id": str(bug.case.id),
        "module": bug.case.module,
        "title": bug.case.title,
        "priority": bug.case.priority,
    } if bug.case else None

    logs = BugLog.query.filter_by(bug_id=bug.id).order_by(BugLog.created_at.desc()).all()
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

    attachments = Attachment.query.filter_by(target_type="bug", target_id=bug.id).order_by(Attachment.created_at.asc()).all()
    data["attachments"] = [
        {
            "id": str(a.id),
            "filename": a.filename,
            "size": a.size,
            "url": f"/uploads/{a.filepath.split('/')[-2]}/{a.filepath.split('/')[-1]}",
            "uploadedBy": {
                "id": str(a.uploader.id),
                "username": a.uploader.username,
                "realname": a.uploader.realname,
            } if a.uploader else None,
            "createdAt": a.created_at.isoformat() if a.created_at else None,
        }
        for a in attachments
    ]

    changes = []
    # T5-2: 关联变更单（Bug → CR 列表）
    if hasattr(bug, 'project'):
        changes = ChangeRequest.query.filter_by(source_type="BUG", source_id=bug.id).order_by(ChangeRequest.updated_at.desc()).all()
    data["changes"] = [
        {
            "id": str(c.id),
            "code": c.code,
            "title": c.title,
            "type": c.type,
            "status": c.status.value if hasattr(c.status, "value") else c.status,
            "srcBranch": c.src_branch,
            "dstBranch": c.dst_branch,
            "riskLevel": c.risk_level,
            "updatedAt": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in changes
    ]

    return jsonify(ok(data)), 200


@bp.post("/bugs/<int:bug_id>/assign")
@_role_required("QA", "ADMIN")
def assign_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    data = request.get_json(silent=True) or {}
    owner_id = data.get("ownerId")
    comment = data.get("comment")
    if not owner_id:
        return jsonify(fail("ownerId 不能为空", 40002)), 400

    owner = User.query.get(owner_id)
    if not owner:
        return jsonify(fail("被分派的用户不存在", 40402)), 404

    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())

    try:
        to_status = assert_bug_transition(bug.status.value if hasattr(bug.status, "value") else bug.status, "assign", role)
    except IllegalTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    bug.status = to_status
    bug.owner_id = int(owner_id)
    db.session.add(BugLog(
        bug_id=bug.id,
        operator_id=operator_id,
        action="assign",
        from_status=bug.status,
        to_status=to_status,
        comment=comment,
    ))
    db.session.commit()
    return jsonify(ok(detail_bug(bug_id).json["data"])), 200


@bp.post("/bugs/<int:bug_id>/start")
@_role_required("DEV")
def start_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())

    try:
        to_status = assert_bug_transition(bug.status.value if hasattr(bug.status, "value") else bug.status, "start", role)
    except IllegalTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    bug.status = to_status
    bug.fixer_id = operator_id
    db.session.add(BugLog(
        bug_id=bug.id,
        operator_id=operator_id,
        action="start",
        from_status=bug.status,
        to_status=to_status,
        comment=None,
    ))
    db.session.commit()
    return jsonify(ok(detail_bug(bug_id).json["data"])), 200


@bp.post("/bugs/<int:bug_id>/fix")
@_role_required("DEV")
def fix_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    data = request.get_json(silent=True) or {}
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())

    try:
        to_status = assert_bug_transition(bug.status.value if hasattr(bug.status, "value") else bug.status, "fix", role)
    except IllegalTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    bug.status = to_status
    bug.root_cause = data.get("rootCause")
    bug.fix_desc = data.get("fixDesc")
    bug.impact = data.get("impact")
    db.session.add(BugLog(
        bug_id=bug.id,
        operator_id=operator_id,
        action="fix",
        from_status=bug.status,
        to_status=to_status,
        comment=f"修复说明：{data.get('fixDesc', '')}",
    ))
    db.session.commit()
    return jsonify(ok(detail_bug(bug_id).json["data"])), 200


@bp.post("/bugs/<int:bug_id>/verify")
@_role_required("QA", "ADMIN")
def verify_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    data = request.get_json(silent=True) or {}
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())
    passed = data.get("passed", True)

    try:
        to_status = assert_bug_transition(bug.status.value if hasattr(bug.status, "value") else bug.status, "verify", role, passed=passed)
    except IllegalTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    bug.status = to_status
    db.session.add(BugLog(
        bug_id=bug.id,
        operator_id=operator_id,
        action="verify",
        from_status=bug.status,
        to_status=to_status,
        comment=data.get("comment") or ("回归验证通过" if passed else f"回归失败：{data.get('comment', '未通过')}"),
    ))
    if not passed:
        db.session.add(BugLog(
            bug_id=bug.id,
            operator_id=operator_id,
            action="reopen",
            from_status="FIXED",
            to_status="IN_PROGRESS",
            comment="回归失败，自动重开（reopen）",
        ))
    db.session.commit()
    return jsonify(ok(detail_bug(bug_id).json["data"])), 200


@bp.post("/bugs/<int:bug_id>/close")
@_role_required("QA", "ADMIN")
def close_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    data = request.get_json(silent=True) or {}
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())
    comment = data.get("comment", "验证通过，关闭缺陷")

    try:
        to_status = assert_bug_transition(bug.status.value if hasattr(bug.status, "value") else bug.status, "close", role)
    except IllegalTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    bug.status = to_status
    db.session.add(BugLog(
        bug_id=bug.id,
        operator_id=operator_id,
        action="close",
        from_status=bug.status,
        to_status=to_status,
        comment=comment,
    ))
    db.session.commit()
    return jsonify(ok(detail_bug(bug_id).json["data"])), 200


@bp.post("/bugs/<int:bug_id>/reopen")
@_role_required("QA", "ADMIN")
def reopen_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    data = request.get_json(silent=True) or {}
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())
    comment = data.get("comment")
    if not comment:
        return jsonify(fail("备注不能为空", 40003)), 400

    try:
        to_status = assert_bug_transition(bug.status.value if hasattr(bug.status, "value") else bug.status, "reopen", role)
    except IllegalTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    bug.status = to_status
    db.session.add(BugLog(
        bug_id=bug.id,
        operator_id=operator_id,
        action="reopen",
        from_status=bug.status,
        to_status=to_status,
        comment=comment,
    ))
    db.session.commit()
    return jsonify(ok(detail_bug(bug_id).json["data"])), 200


@bp.post("/bugs/<int:bug_id>/reject")
@_role_required("ADMIN")
def reject_bug(bug_id: int):
    bug = Bug.query.get_or_404(bug_id)
    data = request.get_json(silent=True) or {}
    claims = getattr(request, "jwt", {}) or {}
    role = claims.get("role")
    operator_id = int(get_jwt_identity())
    reason = data.get("reason")
    if not reason:
        return jsonify(fail("拒绝原因不能为空", 40003)), 400

    try:
        to_status = assert_bug_transition(bug.status.value if hasattr(bug.status, "value") else bug.status, "reject", role)
    except IllegalTransitionError as e:
        return jsonify(fail(str(e), 400)), 400

    bug.status = to_status
    db.session.add(BugLog(
        bug_id=bug.id,
        operator_id=operator_id,
        action="reject",
        from_status=bug.status,
        to_status=to_status,
        comment=f"拒绝原因：{reason}",
    ))
    db.session.commit()
    return jsonify(ok(detail_bug(bug_id).json["data"])), 200
