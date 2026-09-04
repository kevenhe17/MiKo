from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from ..extensions import db
from ..models import Project, User, Requirement, TestCase, TestPlan, Bug, ChangeRequest
from ..utils import ok, fail, paginate


bp = Blueprint("project", __name__)


def _serialize_project(p: Project):
    return {
        "id": str(p.id),
        "code": p.code,
        "name": p.name,
        "description": p.description,
        "createdBy": str(p.created_by),
        "members": p.members or [],
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


def _role_required(*roles):
    def decorator(fn):
        @jwt_required()
        def wrapper(*args, **kwargs):
            identity = get_jwt_identity()
            claims = get_jwt()
            role = claims.get("role")
            if role not in roles:
                return jsonify(fail("权限不足", 40301)), 403
            return fn(*args, **kwargs)
        wrapper.__name__ = fn.__name__
        return wrapper
    return decorator


@bp.post("/projects")
@_role_required("ADMIN")
def create_project():
    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    name = (data.get("name") or "").strip()
    description = data.get("description")
    if not code or not name:
        return jsonify(fail("项目编码和名称不能为空", 40001)), 400

    if Project.query.filter_by(code=code).first():
        return jsonify(fail(f"项目 code「{code}」已存在", 40901)), 409

    operator_id = int(get_jwt_identity())
    project = Project(
        code=code,
        name=name,
        description=description,
        created_by=operator_id,
        members=[{"userId": str(operator_id), "role": "ADMIN"}],
    )
    db.session.add(project)
    db.session.commit()
    return jsonify(ok(_serialize_project(project))), 201


@bp.get("/projects")
@jwt_required()
def list_projects():
    page = max(1, int(request.args.get("page", 1) or 1))
    page_size = min(100, max(1, int(request.args.get("pageSize", 10) or 10)))
    query = Project.query.order_by(Project.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(ok(paginate([_serialize_project(p) for p in items], total, page, page_size))), 200


@bp.get("/projects/<int:project_id>")
@jwt_required()
def detail_project(project_id: int):
    project = Project.query.get_or_404(project_id)
    member_ids = [str(m.get("userId")) for m in (project.members or [])]
    users = User.query.filter(User.id.in_([int(x) for x in member_ids if x.isdigit()])).all() if member_ids else []
    user_map = {str(u.id): u for u in users}
    members = []
    for m in project.members or []:
        uid = str(m.get("userId"))
        u = user_map.get(uid)
        members.append({
            "userId": uid,
            "role": m.get("role"),
            "username": u.username if u else None,
            "realname": u.realname if u else None,
        })
    data = _serialize_project(project)
    data["members"] = members
    data["creator"] = {
        "id": str(project.creator.id) if project.creator else None,
        "username": project.creator.username if project.creator else None,
        "realname": project.creator.realname if project.creator else None,
    }
    return jsonify(ok(data)), 200


@bp.patch("/projects/<int:project_id>")
@_role_required("ADMIN")
def update_project(project_id: int):
    project = Project.query.get_or_404(project_id)
    data = request.get_json(silent=True) or {}
    if "name" in data:
        project.name = data.get("name")
    if "description" in data:
        project.description = data.get("description")
    db.session.commit()
    return jsonify(ok(_serialize_project(project))), 200


@bp.delete("/projects/<int:project_id>")
@_role_required("ADMIN")
def delete_project(project_id: int):
    project = Project.query.get_or_404(project_id)
    counts = {
        "requirement": Requirement.query.filter_by(project_id=project.id).count(),
        "testCase": TestCase.query.filter_by(project_id=project.id).count(),
        "testPlan": TestPlan.query.filter_by(project_id=project.id).count(),
        "bug": Bug.query.filter_by(project_id=project.id).count(),
        "change": ChangeRequest.query.filter_by(project_id=project.id).count(),
    }
    if sum(counts.values()) > 0:
        return jsonify(fail(f"项目下存在关联数据（需求 {counts['requirement']} / 用例 {counts['testCase']} / 计划 {counts['testPlan']} / 缺陷 {counts['bug']} / 变更 {counts['change']}），请先清空后再删除", 40002)), 400
    db.session.delete(project)
    db.session.commit()
    return jsonify(ok({"deleted": True})), 200


@bp.post("/projects/<int:project_id>/members")
@_role_required("ADMIN")
def invite_member(project_id: int):
    project = Project.query.get_or_404(project_id)
    data = request.get_json(silent=True) or {}
    user_id = data.get("userId")
    role = data.get("role")
    if not user_id or not role:
        return jsonify(fail("userId 和 role 不能为空", 40003)), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify(fail("被邀请用户不存在", 40401)), 404

    members = project.members or []
    if any(str(m.get("userId")) == str(user_id) for m in members):
        return jsonify(fail("该用户已是项目成员", 40902)), 409

    members.append({"userId": str(user_id), "role": role})
    project.members = members
    db.session.commit()
    return jsonify(ok(_serialize_project(project))), 200
