import os
from flask import Blueprint, send_from_directory, abort
from flask_jwt_extended import jwt_required
from ..extensions import db
from ..models import Attachment


bp = Blueprint("uploads", __name__)


@bp.get("/uploads/<path:filename>")
@jwt_required(optional=True)
def serve_upload(filename):
    directory = current_app.config.get("UPLOAD_FOLDER", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"))
    filepath = os.path.join(directory, filename)
    if not os.path.isfile(filepath):
        abort(404)
    return send_from_directory(directory, filename)
