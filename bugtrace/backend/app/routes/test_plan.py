from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import TestPlan, Project, User, TestCase
from ..utils import ok, fail, paginate


bp = Blueprint("test_plan", __name__)


def _serialize_plan(plan):
    return {
        "id": str(plan.id),
        "projectId": str(plan.project_id),
        "name": plan.name,
        "ownerId": str(plan.owner_id),
        "caseIds": plan.case_ids or [],
        "status": plan.status,
        "caseCount": len(plan.case_ids or []),
        "createdAt": plan.created_at.isoformat() if plan.created_at else None,
        "updatedAt": plan.updated_at.isoformat() if plan.updated_at else None,
    }


@bp.post("/test-plans")
@jwt_required()
def create_plan():
    data = request.get_json(silent=True) or {}
    project_id = data.get("projectId")
    name = (data.get("name") or "").strip()
    owner_id = data.get("ownerId")
    case_ids = data.get("caseIds") or []
    if not project_id or not name or not owner_id or not case_ids:
        return jsonify(fail("projectId/name/ownerId/caseIds 不能为空", 40001)), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify(fail("项目不存在", 40401)), 404

    owner = User.query.get(owner_id)
    if not owner:
        return jsonify(fail("负责人不存在", 40402)), 404

    cases = TestCase.query.filter(TestCase.id.in_([int(x) for x in case_ids if str(x).isdigit()])).all()
    if len(cases) != len([x for x in case_ids if str(x).isdigit()]):
        return jsonify(fail("勾选的用例中有不存在的 id", 40002)), 400
    if any(str(c.project_id) != str(project_id) for c in cases):
        return jsonify(fail("不能勾选其他项目的用例", 40003)), 400

    plan = TestPlan(
        project_id=int(project_id),
        name=name,
        owner_id=int(owner_id),
        case_ids=[int(x) for x in case_ids if str(x).isdigit()],
        status="READY",
    )
    db.session.add(plan)
    db.session.commit()
    return jsonify(ok(_serialize_plan(plan))), 201


@bp.get("/test-plans")
@jwt_required()
def list_plans():
    project_id = request.args.get("projectId")
    page = max(1, int(request.args.get("page", 1) or 1))
    page_size = min(100, max(1, int(request.args.get("pageSize", 10) or 10)))
    query = TestPlan.query
    if project_id:
        query = query.filter_by(project_id=int(project_id))
    query = query.order_by(TestPlan.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return jsonify(ok(paginate([_serialize_plan(p) for p in items], total, page, page_size))), 200


@bp.get("/test-plans/<int:plan_id>")
@jwt_required()
def detail_plan(plan_id: int):
    plan = TestPlan.query.get_or_404(plan_id)
    data = _serialize_plan(plan)
    case_ids = plan.case_ids or []
    cases = []
    if case_ids:
        cases = TestCase.query.filter(TestCase.id.in_([int(x) for x in case_ids])).all()
    data["cases"] = [
        {
            "id": str(c.id),
            "module": c.module,
            "title": c.title,
            "priority": c.priority,
            "expected": c.expected,
            "requirement": {
                "id": str(c.requirement.id),
                "code": c.requirement.code,
                "title": c.requirement.title,
            } if c.requirement else None,
        }
        for c in cases
    ]
    data["caseCount"] = len(cases)
    return jsonify(ok(data)), 200
