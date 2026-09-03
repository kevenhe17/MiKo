from flask import Blueprint

bp = Blueprint("routes", __name__)

from . import (
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
