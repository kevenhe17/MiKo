from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from ..extensions import db
from ..models import User
from ..utils import ok, fail


bp = Blueprint("auth", __name__)


@bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not username or not password:
        return jsonify(fail("账号或密码不能为空")), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify(fail("账号或密码错误", 40101)), 401

    if not user.password_hash or not __verify_password(password, user.password_hash):
        return jsonify(fail("账号或密码错误", 40101)), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "username": user.username,
            "realname": user.realname,
        },
    )
    payload = {
        "token": token,
        "user": {
            "id": str(user.id),
            "username": user.username,
            "realname": user.realname,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        },
    }
    return jsonify(ok(payload)), 200


@bp.post("/auth/logout")
@jwt_required()
def logout():
    return jsonify(ok({"success": True})), 200


def __verify_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith("$2a$") or password_hash.startswith("$2b$"):
        import bcrypt

        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    from werkzeug.security import check_password_hash

    try:
        return check_password_hash(password_hash, password)
    except Exception:
        import hashlib

        return hashlib.sha256(password.encode("utf-8")).hexdigest() == password_hash
