import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
    # 兼容两种环境变量命名：Docker Compose 注入 JWT_SECRET，本地 .env 常用 JWT_SECRET_KEY
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("JWT_SECRET") or "jwt-secret-change-me"
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///dev.sqlite3")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "webp", "txt", "log", "zip"}
