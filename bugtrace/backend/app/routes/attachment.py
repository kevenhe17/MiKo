import os
from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import Attachment, Project, User
from ..utils import ok, fail


bp = Blueprint("attachment", __name__)


def _allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in current_app.config["ALLOWED_EXTENSIONS"]


def _serialize_attachment(att: Attachment):
    rel = att.filepath.replace("\\", "/")
    return {
        "id": str(att.id),
        "projectId": str(att.project_id),
        "targetType": att.target_type,
        "targetId": str(att.target_id),
        "filename": att.filename,
        "filepath": att.filepath,
        "size": att.size,
        "uploadedBy": str(att.uploaded_by),
        "url": f"/uploads/{rel}",
        "createdAt": att.created_at.isoformat() if att.created_at else None,
    }


@bp.post("/attachments")
@jwt_required()
def upload_attachment():
    if "file" not in request.files:
        return jsonify(fail("缺少文件字段 file", 40001)), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify(fail("文件名为空", 40002)), 400

    project_id = request.form.get("projectId")
    target_type = request.form.get("targetType", "bug")
    if not project_id:
        return jsonify(fail("projectId 不能为空", 40003)), 400

    project = Project.query.get(project_id)
    if not project:
        return jsonify(fail("所属项目不存在", 40401)), 404

    if not _allowed_file(file.filename):
        return jsonify(fail("文件类型不支持", 40004)), 400

    ext = file.filename.rsplit(".", 1)[1].lower()
    month = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y%m")
    filename = secure_filename(file.filename)
    rel_dir = f"{month}"
    abs_dir = os.path.join(current_app.config["UPLOAD_FOLDER"], rel_dir)
    os.makedirs(abs_dir, exist_ok=True)
    rel_path = f"{rel_dir}/{filename}"
    abs_path = os.path.join(current_app.config["UPLOAD_FOLDER"], rel_path)
    file.save(abs_path)
    size = os.path.getsize(abs_path)

    operator_id = int(get_jwt_identity())
    att = Attachment(
        project_id=int(project_id),
        target_type=target_type,
        target_id=0,
        filename=file.filename,
        filepath=rel_path,
        size=size,
        uploaded_by=operator_id,
    )
    db.session.add(att)
    db.session.commit()
    return jsonify(ok(_serialize_attachment(att))), 201


@bp.get("/attachments/<int:attachment_id>")
@jwt_required()
def download_attachment(attachment_id: int):
    att = Attachment.query.get_or_404(attachment_id)
    directory = current_app.config["UPLOAD_FOLDER"]
    filename = os.path.basename(att.filepath)
    return send_from_directory(directory, filename, as_attachment=True, download_name=att.filename)
