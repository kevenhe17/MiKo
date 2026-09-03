# BugTrace Flask 后端镜像
FROM python:3.12-slim AS runner

WORKDIR /app

# 安装系统依赖（PostgreSQL 客户端库）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 容器内 uploads 目录（挂载数据盘 /data/bugtrace/uploads）
RUN mkdir -p /app/uploads

EXPOSE 3000

# 启动时自动应用迁移、灌入种子、运行服务
CMD ["sh", "-c", "flask db upgrade && flask seed && gunicorn -w 4 -b 0.0.0.0:3000 wsgi:app"]
