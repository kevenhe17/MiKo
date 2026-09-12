from datetime import datetime, timezone
from .extensions import db
from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    Integer,
    DateTime,
    Date,
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


class ApplicationStatus(enum.Enum):
    """软件立项申请单状态（v0.2）。

    v0.2 仅落库状态与企微审批单号，真正的企微 API 交互在 P7 阶段接入；
    WecomStatus 与 wecom_sp_no 联合表达"系统状态 / 企微侧状态"双写。
    """

    DRAFT = "DRAFT"            # 草稿：申请人尚未提交
    SUBMITTED = "SUBMITTED"    # 已提交：等待推送企微审批
    APPROVING = "APPROVING"    # 审批中：已推送企微，等待审批人处理
    APPROVED = "APPROVED"      # 审批通过：可生效创建软件
    REJECTED = "REJECTED"      # 审批驳回
    CANCELED = "CANCELED"      # 已撤回：申请人主动撤回
    EFFECTED = "EFFECTED"      # 已生效：已创建对应的软件（project 记录）


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
    submitted_applications = relationship("ProjectApplication", back_populates="applicant", foreign_keys="ProjectApplication.applicant_id")
    approved_applications = relationship("ProjectApplication", back_populates="approver", foreign_keys="ProjectApplication.approved_by")
    application_ops = relationship("ProjectApplicationLog", back_populates="operator")


class Project(db.Model):
    __tablename__ = "project"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), unique=True, nullable=False)
    name = Column(String(128), nullable=False)
    # v0.2: 软件版本号（原 code 仅作唯一标识，前端展示改用 version）
    version = Column(String(64), nullable=True)
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
    applications = relationship("ProjectApplication", back_populates="project")


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


class ProjectApplication(db.Model):
    """软件立项申请表（v0.2 T5-2）。

    变更流转 → 软件立项：申请人填写立项信息，走企业微信审批，
    审批通过后"生效"自动创建 Project（软件管理）记录并回填 project_id。

    注意：本表 v0.2 新增，db.create_all() 可直接建表；
    若旧库已存在同名表（不会发生），需走 Alembic 迁移。
    """

    __tablename__ = "project_application"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 申请单号，格式 APP-{projectCode}-{seq}，全局唯一
    code = Column(String(64), unique=True, nullable=False)

    # 立项主体信息
    name = Column(String(128), nullable=False)          # 软件名称
    version = Column(String(64), nullable=False)        # 拟立版本号，如 V1.0.0
    applicant_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    dept = Column(String(64), nullable=True)            # 申请部门
    category = Column(String(32), nullable=False)       # 立项类别：NEW/UPGRADE/HOTFIX/RESEARCH
    background = Column(Text, nullable=True)            # 立项背景
    target = Column(Text, nullable=True)                # 立项目标
    scope = Column(Text, nullable=True)                 # 交付范围
    deliverables = Column(Text, nullable=True)          # 交付物清单
    risk_note = Column(Text, nullable=True)             # 风险评估
    remark = Column(Text, nullable=True)                # 备注
    plan_start_at = Column(Date, nullable=True)         # 计划开始日期
    plan_end_at = Column(Date, nullable=True)           # 计划完成日期
    attachments = Column(JSON, nullable=True)           # 附件 id 列表

    # 审批状态
    status = Column(SAEnum(ApplicationStatus), default=ApplicationStatus.DRAFT, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("user.id"), nullable=True)
    reject_reason = Column(Text, nullable=True)

    # 企业微信审批（P7 接入，字段先行）
    wecom_sp_no = Column(String(64), nullable=True)        # 企微审批单号
    wecom_template_id = Column(String(64), nullable=True)  # 企微审批模板 id
    wecom_status = Column(String(16), nullable=True)       # 企微侧状态原样留存
    wecom_detail = Column(JSON, nullable=True)             # 企微回调原始内容

    # 生效后关联的软件（Project）记录
    project_id = Column(Integer, ForeignKey("project.id"), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    applicant = relationship("User", back_populates="submitted_applications", foreign_keys=[applicant_id])
    approver = relationship("User", back_populates="approved_applications", foreign_keys=[approved_by])
    project = relationship("Project", back_populates="applications")
    logs = relationship("ProjectApplicationLog", back_populates="application", cascade="all, delete-orphan")


class ProjectApplicationLog(db.Model):
    """软件立项审批流水（v0.2 T5-2）。

    记录每一次状态流转，供详情页展示审批轨迹。
    """

    __tablename__ = "project_application_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    application_id = Column(Integer, ForeignKey("project_application.id"), nullable=False)
    operator_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    action = Column(String(32), nullable=False)
    from_status = Column(SAEnum(ApplicationStatus), nullable=False)
    to_status = Column(SAEnum(ApplicationStatus), nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    application = relationship("ProjectApplication", back_populates="logs")
    operator = relationship("User", back_populates="application_ops")


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
