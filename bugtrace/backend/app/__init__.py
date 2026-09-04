import os
from datetime import datetime, timezone
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .config import Config
from .extensions import db
from .utils import get_now_iso


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['DEBUG'] = False
    app.config['PROPAGATE_EXCEPTIONS'] = False

    db.init_app(app)
    JWTManager(app)
    CORS(app)

    from .routes import (
        auth,
        project,
        requirement,
        test_case,
        test_plan,
        bug,
        attachment,
        change_request,
        health,
        user,
        uploads,
    )
    app.register_blueprint(auth.bp)
    app.register_blueprint(project.bp)
    app.register_blueprint(requirement.bp)
    app.register_blueprint(test_case.bp)
    app.register_blueprint(test_plan.bp)
    app.register_blueprint(bug.bp)
    app.register_blueprint(attachment.bp)
    app.register_blueprint(change_request.bp)
    app.register_blueprint(health.bp)
    app.register_blueprint(user.bp)
    app.register_blueprint(uploads.bp)

    @app.route("/")
    def index():
        return {"code": 0, "message": "ok", "data": {"name": "BugTrace Flask API", "version": "0.1.1"}}

    from flask import jsonify
    from werkzeug.exceptions import HTTPException

    @app.errorhandler(Exception)
    def handle_all_exceptions(e):
        if isinstance(e, HTTPException):
            code = e.code
            message = e.description
        else:
            code = 500
            message = 'internal server error'
        return jsonify({"code": code, "message": message, "data": None}), code

    @app.context_processor
    def inject_helpers():
        return {"get_now_iso": get_now_iso}

    # 注册 CLI 命令（延迟导入避免循环依赖）：flask seed
    from .commands import seed_command
    app.cli.add_command(seed_command)

    return app
