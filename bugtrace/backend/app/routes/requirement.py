from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Requirement, Project
from ..utils import ok, fail, paginate


bp = Blueprint("requirement", __name__)


def _serialize_requirement(r: Requirement):
    return {
        "id": str(r.id),
        "projectId": str(r.project_id),
        "code": r.code,
        "title": r.title,
        "description": r.description,
        "status": r.status,
        "createdAt": r.created_at.isoformat() if r.created_at else None,
        "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
    }


@bp.post("/requirements")
@jwt_required()
def create_requirement():
    data = request.get_json(silent=True) or {}
    project_id = data.get("projectId")
    code = (data.get("code") or "").strip()
    title = (data.get("title") or "").strip()
    description = data.get("description")
    if not project_id or not code or not title:
        return jsonify(fail("projectId、code、title 不能为空", 40001)), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify(fail("项目不存在", 40401)), 404

    if Requirement.query.filter_by(code=code).first():
        return jsonify(fail(f"需求 code「{code}」已存在", 40901)), 409

    req = Requirement(
        project_id=int(project_id),
        code=code,
        title=title,
        description=description,
    )
    db.session.add(req)
    db.session.commit()
    return jsonify(ok(_serialize_requirement(req))), 201


@bp.get("/requirements")
@jwt_required()
def list_requirements():
    project_id = request.args.get("projectId")
    page = max(1, int(request.args.get("page", 1) or 1))
    page_size = min(100, max(1, int(request.args.get("pageSize", 10) or 10)))
    query = Requirement.query
    if project_id:
        query = query.filter_by(project_id=int(project_id))
    query = query.order_by(Requirement.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(ok(paginate([_serialize_requirement(r) for r in items], total, page, page_size))), 200


@bp.get("/requirements/<int:requirement_id>")
@jwt_required()
def detail_requirement(requirement_id: int):
    req = Requirement.query.get_or_404(requirement_id)
    return jsonify(ok(_serialize_requirement(req))), 200
