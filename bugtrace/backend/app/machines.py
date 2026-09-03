from enum import Enum


class BugStatus(str, Enum):
    NEW = "NEW"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    FIXED = "FIXED"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"


class BugAction(str):
    ASSIGN = "assign"
    START = "start"
    FIX = "fix"
    VERIFY = "verify"
    CLOSE = "close"
    REOPEN = "reopen"
    REJECT = "reject"


TRANSITIONS = {
    BugStatus.NEW: [BugStatus.ASSIGNED],
    BugStatus.ASSIGNED: [BugStatus.IN_PROGRESS, BugStatus.CLOSED],
    BugStatus.IN_PROGRESS: [BugStatus.FIXED],
    BugStatus.FIXED: [BugStatus.VERIFIED, BugStatus.IN_PROGRESS],
    BugStatus.VERIFIED: [BugStatus.CLOSED, BugStatus.IN_PROGRESS],
    BugStatus.CLOSED: [],
}

ACTIONS = {
    BugAction.ASSIGN: {"from": BugStatus.NEW, "to": BugStatus.ASSIGNED, "roles": ["QA", "ADMIN"], "label": "分派"},
    BugAction.START: {"from": BugStatus.ASSIGNED, "to": BugStatus.IN_PROGRESS, "roles": ["DEV"], "label": "开始处理"},
    BugAction.FIX: {"from": BugStatus.IN_PROGRESS, "to": BugStatus.FIXED, "roles": ["DEV"], "label": "填写修复"},
    BugAction.VERIFY: {"from": BugStatus.FIXED, "to": BugStatus.VERIFIED, "roles": ["QA", "ADMIN"], "label": "回归验证"},
    BugAction.CLOSE: {"from": BugStatus.VERIFIED, "to": BugStatus.CLOSED, "roles": ["QA", "ADMIN"], "label": "关闭"},
    BugAction.REOPEN: {"from": BugStatus.FIXED, "to": BugStatus.IN_PROGRESS, "roles": ["QA", "ADMIN"], "label": "重开", "extra_from": [BugStatus.VERIFIED]},
    BugAction.REJECT: {"from": BugStatus.ASSIGNED, "to": BugStatus.CLOSED, "roles": ["ADMIN"], "label": "拒绝"},
}

REOPEN_EXTRA_FROM = [BugStatus.VERIFIED]


def bug_action_target(status, action: str, passed=None):
    if action == BugAction.VERIFY:
        if status != BugStatus.FIXED:
            return None
        return BugStatus.IN_PROGRESS if passed is False else BugStatus.VERIFIED
    if action == BugAction.REOPEN:
        return BugStatus.IN_PROGRESS if status in (BugStatus.FIXED, BugStatus.VERIFIED) else None
    defn = ACTIONS.get(action)
    if not defn:
        return None
    return defn["to"] if status == defn["from"] else None


def assert_bug_transition(status, action: str, role, passed=None):
    if status == BugStatus.CLOSED:
        raise IllegalTransitionError(f"当前状态 {status} 为终态，不能再流转")
    defn = ACTIONS.get(action)
    if not defn:
        raise IllegalTransitionError(f"未知动作：{action}")
    if role not in defn["roles"]:
        raise IllegalTransitionError(f"角色 {role} 无权执行「{defn['label']}」（允许角色：{'/'.join(defn['roles'])}）")
    legal_froms = [defn["from"]]
    if action == BugAction.REOPEN:
        legal_froms += REOPEN_EXTRA_FROM
    if status not in legal_froms:
        legal_targets = TRANSITIONS.get(status, [])
        raise IllegalTransitionError(f"当前状态 {status} 不能执行「{defn['label']}」；当前状态的合法目标：{'/'.join([t.value for t in legal_targets]) or '无（终态）'}")
    target = bug_action_target(status, action, passed)
    if target is None:
        raise IllegalTransitionError(f"当前状态 {status} 不能执行「{defn['label']}」")
    return target


class IllegalTransitionError(Exception):
    pass


class ChangeStatus(str, Enum):
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


CR_ACTIONS = {
    "submit": {"from": ChangeStatus.DRAFT, "to": ChangeStatus.IN_REVIEW, "roles": ["DEV", "ADMIN"], "label": "提交评审"},
    "approve": {"from": ChangeStatus.IN_REVIEW, "to": ChangeStatus.APPROVED, "roles": ["DEV", "ADMIN"], "label": "评审通过"},
    "reject-review": {"from": ChangeStatus.IN_REVIEW, "to": ChangeStatus.DRAFT, "roles": ["DEV", "ADMIN"], "label": "评审驳回", "requireComment": True},
    "start-build": {"from": ChangeStatus.APPROVED, "to": ChangeStatus.BUILDING, "roles": ["ADMIN"], "label": "触发构建"},
    "build-done": {"from": ChangeStatus.BUILDING, "to": ChangeStatus.REGRESSION, "roles": ["ADMIN"], "label": "构建完成"},
    "regression-done": {"from": ChangeStatus.REGRESSION, "to": ChangeStatus.GATE_CHECK, "roles": ["QA", "ADMIN"], "label": "回归完成"},
    "gate-pass": {"from": ChangeStatus.GATE_CHECK, "to": ChangeStatus.AWAITING_MERGE, "roles": ["ADMIN"], "label": "门禁通过"},
    "merge": {"from": ChangeStatus.AWAITING_MERGE, "to": ChangeStatus.MERGED, "roles": ["ADMIN"], "label": "合入目标分支"},
    "release": {"from": ChangeStatus.MERGED, "to": ChangeStatus.RELEASED, "roles": ["ADMIN"], "label": "发布"},
    "abandon": {"from": "*", "to": ChangeStatus.ABANDONED, "roles": ["DEV", "QA", "ADMIN"], "label": "废弃", "requireComment": True},
}

CR_TERMINAL = [ChangeStatus.RELEASED, ChangeStatus.ABANDONED]


def assert_cr_transition(status, action: str, role):
    if status in CR_TERMINAL:
        raise IllegalCrTransitionError(f"当前状态 {status} 为终态，不能再流转")
    defn = CR_ACTIONS.get(action)
    if not defn:
        raise IllegalCrTransitionError(f"未知动作：{action}")
    if role not in defn["roles"]:
        raise IllegalCrTransitionError(f"角色 {role} 无权执行「{defn['label']}」（允许角色：{'/'.join(defn['roles'])}）")
    if defn["from"] != "*" and status != defn["from"]:
        raise IllegalCrTransitionError(f"当前状态 {status} 不能执行「{defn['label']}」（该动作要求起点：{defn['from']}）")
    return defn["to"]


def available_cr_actions(status, role):
    result = []
    for action, defn in CR_ACTIONS.items():
        if role not in defn["roles"]:
            continue
        if status in CR_TERMINAL:
            continue
        if defn["from"] == "*" or defn["from"] == status:
            result.append(action)
    return result


class IllegalCrTransitionError(Exception):
    pass
