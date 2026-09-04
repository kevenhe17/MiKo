"""Quick init script: create tables and seed data."""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DATABASE_URL", "sqlite:///dev.sqlite3")

from wsgi import app
from app.extensions import db
from app.models import User, Role, Project
from bcrypt import hashpw, gensalt

with app.app_context():
    db.create_all()
    print("Tables created.")

    if not User.query.filter_by(username="admin").first():
        db.session.add(User(
            username="admin",
            password_hash=hashpw("admin123".encode(), gensalt()).decode(),
            realname="管理员",
            role=Role.ADMIN,
        ))
    if not User.query.filter_by(username="dev").first():
        db.session.add(User(
            username="dev",
            password_hash=hashpw("dev123".encode(), gensalt()).decode(),
            realname="开发工程师",
            role=Role.DEV,
        ))
    if not User.query.filter_by(username="qa").first():
        db.session.add(User(
            username="qa",
            password_hash=hashpw("qa123".encode(), gensalt()).decode(),
            realname="测试工程师",
            role=Role.QA,
        ))
    db.session.commit()
    print("Seed users created.")

    if not Project.query.filter_by(code="BUGTRACE").first():
        admin = User.query.filter_by(username="admin").first()
        db.session.add(Project(
            code="BUGTRACE",
            name="BugTrace 默认项目",
            description="系统默认项目",
            created_by=admin.id,
            members=[admin.id],
        ))
        db.session.commit()
        print("Default project created.")

    print("Done.")
