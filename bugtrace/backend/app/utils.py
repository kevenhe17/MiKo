from datetime import datetime, timezone


def get_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ok(data=None, message="ok", code=0):
    return {"code": code, "message": message, "data": data}


def fail(message="操作失败", code=1, data=None):
    return {"code": code, "message": message, "data": data}


def paginate(items, total, page, page_size):
    return {"list": items, "total": total, "page": page, "pageSize": page_size}


def generate_code(prefix: str, seq: int) -> str:
    return f"{prefix}-{seq:04d}"
