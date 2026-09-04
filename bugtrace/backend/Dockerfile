# BugTrace Flask 后端镜像
FROM python:3.12-slim AS runner

WORKDIR /app

# 安装系统依赖（PostgreSQL 客户端库）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY . .

# 容器内 uploads 目录（挂载数据盘 /data/bugtrace/uploads）
RUN mkdir -p /app/uploads

# flask CLI 应用入口（flask seed 依赖它定位 app）
ENV FLASK_APP=wsgi.py

EXPOSE 3000

# 启动：seed 命令内部执行 db.create_all() 建表并灌入初始账号（幂等）
# 注：当前 migrations/versions 为空，故不执行 flask db upgrade，改由 seed 建表
CMD ["sh", "-c", "flask seed && gunicorn -w 4 -b 0.0.0.0:3000 wsgi:app"]
