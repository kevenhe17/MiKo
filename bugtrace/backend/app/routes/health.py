from flask import Blueprint, jsonify
from ..extensions import db
from ..utils import ok


bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return jsonify(ok({"database": db_ok})), 200
