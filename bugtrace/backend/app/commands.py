"""Flask CLI 自定义命令。

seed：建表 + 灌入初始账号与默认项目，幂等可重复执行。
部署时在容器内通过 `flask seed` 调用（见 backend/Dockerfile CMD）。
"""
import os

import click
from flask.cli import with_appcontext
from bcrypt import hashpw, gensalt

from .extensions import db
from .models import User, Role, Project

# 初始账号默认密码，可用环境变量覆盖（生产建议部署后强制修改）
DEFAULT_PASSWORD = os.getenv("SEED_PASSWORD", "123456")

SEED_USERS = (
    ("admin", "系统管理员", Role.ADMIN),
    ("dev", "开发工程师", Role.DEV),
    ("qa", "测试工程师", Role.QA),
)


def _hash_password(plain: str) -> str:
    return hashpw(plain.encode("utf-8"), gensalt()).decode("utf-8")


@click.command("seed")
@with_appcontext
def seed_command():
    """建表并灌入初始数据（幂等）。"""
    db.create_all()
    click.echo("Tables ready.")

    created_users = []
    for username, realname, role in SEED_USERS:
        if User.query.filter_by(username=username).first():
            continue
        db.session.add(
            User(
                username=username,
                password_hash=_hash_password(DEFAULT_PASSWORD),
                realname=realname,
                role=role,
            )
        )
        created_users.append(username)
    db.session.commit()

    admin = User.query.filter_by(username="admin").first()
    if admin and not Project.query.filter_by(code="BUGTRACE").first():
        db.session.add(
            Project(
                code="BUGTRACE",
                name="BugTrace 默认项目",
                description="系统默认项目",
                created_by=admin.id,
                members=[admin.id],
            )
        )
        db.session.commit()

    click.echo(
        "Seed done. new users: %s"
        % (", ".join(created_users) if created_users else "none (already exists)")
    )
