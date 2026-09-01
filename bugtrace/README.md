# BugTrace MVP · 开发环境

本地开发环境基于 Docker Compose 一键启动（仅 2 个容器：postgres + app）。

## 环境要求

- Docker Engine 20.10+ / Docker Desktop（含 docker compose 插件）
- Node 22（本仓库后续前后端开发需要，容器内为 node:22）

## 启动

```bash
docker compose up -d
```

## 停止

```bash
docker compose down
```

（如需连数据卷一起删除：`docker compose down -v`，会清空数据库数据）

## 查看日志

```bash
# 全部容器
docker compose logs -f

# 只看某一个
docker compose logs -f app
docker compose logs -f postgres
```

## 常用命令

```bash
docker compose ps            # 查看容器状态（两容器应均为 healthy）
docker compose restart app   # 重启 app
```

## 端口与连接信息

| 项 | 值 | 来源 |
|---|---|---|
| app 端口 | 3000 | `APP_PORT`（.env） |
| postgres 端口 | 5432 | `DB_PORT`（.env） |
| 数据库账号 | `bugtrace` | `DB_USER` |
| 数据库密码 | 见 .env | `DB_PASSWORD` |
| 数据库名 | `bugtrace` | `DB_NAME` |

宿主机连接数据库：`psql -h 127.0.0.1 -p 5432 -U bugtrace -d bugtrace`，输入 .env 中的密码。

容器内部：app 容器内通过主机名 `postgres` 访问数据库（端口 5432）。

## 当前阶段说明

T0-1 阶段 app 容器为占位进程（仅保活并探测数据库连通性），业务代码由后续任务注入。
