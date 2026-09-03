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

    @app.context_processor
    def inject_helpers():
        return {"get_now_iso": get_now_iso}

    return app
