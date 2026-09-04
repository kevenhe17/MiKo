from datetime import datetime, timezone
from .extensions import db
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    DateTime,
    JSON,
    Enum as SAEnum,
    ForeignKey,
)
from sqlalchemy.orm import relationship
import enum


class Role(enum.Enum):
    ADMIN = "ADMIN"
    DEV = "DEV"
    QA = "QA"


class BugStatus(enum.Enum):
    NEW = "NEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    FIXED = "FIXED"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"


class BugSeverity(enum.Enum):
    BLOCKER = "BLOCKER"
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    MINOR = "MINOR"


class ChangeStatus(enum.Enum):
    DRAFT = "DRAFT"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    BUILDING = "BUILDING"
    REGRESSION = "REGRESSION"
    GATE_CHECK = "GATE_CHECK"
    AWAITING_MERGE = "AWAITING_MERGE"
    MERGED = "MERGED"
    RELEASED = "RELEASED"
    ABANDONED = "ABANDONED"


class User(db.Model):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    realname = Column(String(64), nullable=False)
    role = Column(SAEnum(Role), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    created_projects = relationship("Project", back_populates="creator", foreign_keys="Project.created_by")
    owned_bugs = relationship("Bug", back_populates="owner", foreign_keys="Bug.owner_id")
    fixed_bugs = relationship("Bug", back_populates="fixer", foreign_keys="Bug.fixer_id")
    uploads = relationship("Attachment", back_populates="uploader")
    operations = relationship("BugLog", back_populates="operator")
    owned_plans = relationship("TestPlan", back_populates="owner")
    owned_changes = relationship("ChangeRequest", back_populates="owner", foreign_keys="ChangeRequest.owner_id")
    reviewed_changes = relationship("ChangeRequest", back_populates="reviewer", foreign_keys="ChangeRequest.reviewer_id")
    merged_changes = relationship("ChangeRequest", back_populates="merger", foreign_keys="ChangeRequest.merged_by")
    change_ops = relationship("ChangeLog", back_populates="operator")


class Project(db.Model):
    __tablename__ = "project"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    members = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    creator = relationship("User", back_populates="created_projects", foreign_keys=[created_by])
    requirements = relationship("Requirement", back_populates="project")
    test_cases = relationship("TestCase", back_populates="project")
    bugs = relationship("Bug", back_populates="project")
    attachments = relationship("Attachment", back_populates="project")
    test_plans = relationship("TestPlan", back_populates="project")
    change_requests = relationship("ChangeRequest", back_populates="project")


class Requirement(db.Model):
    __tablename__ = "requirement"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    code = Column(String(64), unique=True, nullable=False)
    title = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(16), default="OPEN")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="requirements")
    test_cases = relationship("TestCase", back_populates="requirement")
    bugs = relationship("Bug", back_populates="requirement")


class TestCase(db.Model):
    __tablename__ = "test_case"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    module = Column(String(64), nullable=False)
    title = Column(String(128), nullable=False)
    precond = Column(Text, nullable=True)
    steps = Column(Text, nullable=False)
    expected = Column(Text, nullable=False)
    priority = Column(String(8), nullable=True)
    requirement_id = Column(Integer, ForeignKey("requirement.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="test_cases")
    requirement = relationship("Requirement", back_populates="test_cases")
    bugs = relationship("Bug", back_populates="case")


class Bug(db.Model):
    __tablename__ = "bug"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    code = Column(String(64), unique=True, nullable=False)
    title = Column(String(128), nullable=False)
    severity = Column(SAEnum(BugSeverity), nullable=False)
    priority = Column(String(8), nullable=True)
    status = Column(SAEnum(BugStatus), default=BugStatus.NEW)
    module = Column(String(64), nullable=False)
    environment = Column(String(128), nullable=True)
    steps = Column(Text, nullable=False)
    expected = Column(Text, nullable=False)
    actual = Column(Text, nullable=False)
    owner_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    fixer_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    root_cause = Column(Text, nullable=True)
    fix_desc = Column(Text, nullable=True)
    impact = Column(Text, nullable=True)
    requirement_id = Column(Integer, ForeignKey("requirement.id"), nullable=True)
    case_id = Column(Integer, ForeignKey("test_case.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="bugs")
    requirement = relationship("Requirement", back_populates="bugs")
    case = relationship("TestCase", back_populates="bugs")
    owner = relationship("User", back_populates="owned_bugs", foreign_keys=[owner_id])
    fixer = relationship("User", back_populates="fixed_bugs", foreign_keys=[fixer_id])
    logs = relationship("BugLog", back_populates="bug", cascade="all, delete-orphan")


class Attachment(db.Model):
    __tablename__ = "attachment"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    target_type = Column(String(16), nullable=False)
    target_id = Column(Integer, nullable=False)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)
    uploaded_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="attachments")
    uploader = relationship("User", back_populates="uploads")


class BugLog(db.Model):
    __tablename__ = "bug_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bug_id = Column(Integer, ForeignKey("bug.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    action = Column(String(32), nullable=False)
    from_status = Column(SAEnum(BugStatus), nullable=False)
    to_status = Column(SAEnum(BugStatus), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    bug = relationship("Bug", back_populates="logs")
    operator = relationship("User", back_populates="operations")


class TestPlan(db.Model):
    __tablename__ = "test_plan"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    name = Column(String(128), nullable=False)
    owner_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    case_ids = Column(JSON, default=list)
    status = Column(String(16), default="READY")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="test_plans")
    owner = relationship("User", back_populates="owned_plans")


class ChangeRequest(db.Model):
    __tablename__ = "change_request"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("project.id"), nullable=False)
    code = Column(String(64), unique=True, nullable=False)
    title = Column(String(128), nullable=False)
    type = Column(String(32), nullable=False)
    source_type = Column(String(32), nullable=False)
    source_id = Column(Integer, nullable=True)
    version = Column(String(64), nullable=True)
    src_branch = Column(String(64), nullable=False)
    dst_branch = Column(String(64), nullable=False)
    risk_level = Column(String(8), default="MEDIUM")
    need_regression = Column(Boolean, default=True)
    status = Column(SAEnum(ChangeStatus), default=ChangeStatus.DRAFT)
    owner_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    backflow_status = Column(String(16), nullable=True)
    conflict_files = Column(JSON, nullable=True)
    rolled_back = Column(Boolean, default=False)
    merged_at = Column(DateTime, nullable=True)
    merged_by = Column(Integer, ForeignKey("user.id"), nullable=True)
    merged_sha = Column(String(64), nullable=True)
    tag = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="change_requests")
    owner = relationship("User", back_populates="owned_changes", foreign_keys=[owner_id])
    reviewer = relationship("User", back_populates="reviewed_changes", foreign_keys=[reviewer_id])
    merger = relationship("User", back_populates="merged_changes", foreign_keys=[merged_by])
    logs = relationship("ChangeLog", back_populates="cr", cascade="all, delete-orphan")


class ChangeLog(db.Model):
    __tablename__ = "change_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cr_id = Column(Integer, ForeignKey("change_request.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    action = Column(String(32), nullable=False)
    from_status = Column(SAEnum(ChangeStatus), nullable=False)
    to_status = Column(SAEnum(ChangeStatus), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    cr = relationship("ChangeRequest", back_populates="logs")
    operator = relationship("User", back_populates="change_ops")
