from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User
from ..utils import ok


bp = Blueprint("user", __name__)


@bp.get("/users")
@jwt_required()
def list_users():
    users = User.query.order_by(User.id.asc()).all()
    data = [
        {
            "id": str(u.id),
            "username": u.username,
            "realname": u.realname,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
        }
        for u in users
    ]
    return jsonify(ok(data)), 200


@bp.get("/users/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return jsonify(
        ok(
            {
                "id": str(user.id),
                "username": user.username,
                "realname": user.realname,
                "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            }
        )
    ), 200
