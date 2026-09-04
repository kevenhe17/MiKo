"""Flask CLI 自定义命令。

seed：建表 + 灌入初始账号与默认项目，幂等可重复执行。
部署时在容器内通过 `flask seed` 调用（见 backend/Dockerfile CMD）。
"""
import os

import click
from flask.cli import with_appcontext
from sqlalchemy import text
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

# 默认项目初始版本号（v0.2 起 project 表引入 version 字段）
DEFAULT_PROJECT_VERSION = "V0.1.0"


def _hash_password(plain: str) -> str:
    return hashpw(plain.encode("utf-8"), gensalt()).decode("utf-8")


def _migrate_add_project_version() -> None:
    """轻量迁移：为旧库的 project 表补充 version 列并回填历史数据。

    v0.2 起 Project 新增 version 字段；db.create_all() 不会修改已存在的表，
    因此对旧库（v0.1 建）需要 ALTER TABLE 补列，并把历史行回填为 code 值。
    幂等：列已存在时直接跳过。
    """
    dialect = db.session.bind.dialect.name if db.session.bind else "sqlite"
    if dialect == "sqlite":
        exists = db.session.execute(
            text("SELECT 1 FROM pragma_table_info('project') WHERE name='version'")
        ).first()
    else:  # postgresql
        exists = db.session.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name='project' AND column_name='version'"
            )
        ).first()
    if exists:
        return

    db.session.execute(text("ALTER TABLE project ADD COLUMN version VARCHAR(64)"))
    # 历史数据回填：无版本号的旧项目先用 code 占位，避免前端展示为空
    db.session.execute(text("UPDATE project SET version = code WHERE version IS NULL"))
    db.session.commit()
    click.echo("Migrated: project.version column added (backfilled from code).")


@click.command("seed")
@with_appcontext
def seed_command():
    """建表并灌入初始数据（幂等）。"""
    db.create_all()
    _migrate_add_project_version()
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
                version=DEFAULT_PROJECT_VERSION,
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
