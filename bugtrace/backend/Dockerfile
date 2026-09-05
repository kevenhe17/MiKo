# BugTrace Flask 后端镜像
FROM python:3.12-slim AS runner

WORKDIR /app

# 安装系统依赖（PostgreSQL 客户端库）——apt 走清华源加速国内构建
RUN sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || \
    sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g; s|security.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list 2>/dev/null || true; \
    apt-get update && apt-get install -y --no-install-recommends \
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
#
# gunicorn 参数说明：
#   --timeout 60              请求超时（默认 30s，慢查询会被判死返回 502/504）
#   --graceful-timeout 30     优雅退出时间
#   --keep-alive 5            HTTP keep-alive，减少重复建连
#   --max-requests 1000(+jitter) 定期回收 worker，避免内存泄漏累积
CMD ["sh", "-c", "flask seed && gunicorn -w 4 -b 0.0.0.0:3000 --timeout 60 --graceful-timeout 30 --keep-alive 5 --max-requests 1000 --max-requests-jitter 100 --access-logfile - wsgi:app"]
