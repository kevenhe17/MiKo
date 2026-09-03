from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import TestCase, Project, Requirement
from ..utils import ok, fail, paginate


bp = Blueprint("test_case", __name__)


def _serialize_case(tc: TestCase):
    return {
        "id": str(tc.id),
        "projectId": str(tc.project_id),
        "module": tc.module,
        "title": tc.title,
        "precond": tc.precond,
        "steps": tc.steps,
        "expected": tc.expected,
        "priority": tc.priority,
        "requirementId": str(tc.requirement_id) if tc.requirement_id else None,
        "createdAt": tc.created_at.isoformat() if tc.created_at else None,
        "updatedAt": tc.updated_at.isoformat() if tc.updated_at else None,
    }


@bp.post("/test-cases")
@jwt_required()
def create_case():
    data = request.get_json(silent=True) or {}
    project_id = data.get("projectId")
    module = (data.get("module") or "").strip()
    title = (data.get("title") or "").strip()
    steps = data.get("steps")
    expected = data.get("expected")
    if not project_id or not module or not title or not steps or not expected:
        return jsonify(fail("projectId/module/title/steps/expected 不能为空", 40001)), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify(fail("项目不存在", 40401)), 404

    requirement_id = data.get("requirementId")
    if requirement_id:
        req = Requirement.query.get(requirement_id)
        if not req or str(req.project_id) != str(project_id):
            return jsonify(fail("关联需求不存在或不属于该项目", 40002)), 400

    tc = TestCase(
        project_id=int(project_id),
        module=module,
        title=title,
        precond=data.get("precond"),
        steps=steps,
        expected=expected,
        priority=data.get("priority"),
        requirement_id=int(requirement_id) if requirement_id else None,
    )
    db.session.add(tc)
    db.session.commit()
    return jsonify(ok(_serialize_case(tc))), 201


@bp.get("/test-cases")
@jwt_required()
def list_cases():
    project_id = request.args.get("projectId")
    page = max(1, int(request.args.get("page", 1) or 1))
    page_size = min(100, max(1, int(request.args.get("pageSize", 10) or 10)))
    query = TestCase.query
    if project_id:
        query = query.filter_by(project_id=int(project_id))
    query = query.order_by(TestCase.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(ok(paginate([_serialize_case(tc) for tc in items], total, page, page_size))), 200


@bp.get("/test-cases/<int:case_id>")
@jwt_required()
def detail_case(case_id: int):
    tc = TestCase.query.get_or_404(case_id)
    return jsonify(ok(_serialize_case(tc))), 200
