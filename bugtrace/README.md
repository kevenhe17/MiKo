# BugTrace · Bug 跟踪与测试验收协同平台（MVP）

从「建项目 → 登记需求 → 写用例 → 提 Bug → 修复 → 回归 → 关闭」的完整闭环，另含「主干/分支软件变更流转」模块（CR 状态机 + 报表图表）。

- 后端：NestJS 10 + Prisma 6 + PostgreSQL 16
- 前端：Vue 3.5 + Element Plus 2.8 + Pinia + ECharts
- 部署形态：Docker Compose 单机（postgres + app 两容器），不上 K8s

## 1. 环境要求

| 项 | 要求 |
|---|---|
| Docker | Docker Engine 20.10+ / Docker Desktop（含 docker compose 插件），WSL2 已启用 |
| Node.js | 22.x（前后端本机开发；容器内亦为 node:22） |
| npm | 10.x（随 Node 22 附带） |

## 2. 从零启动（新人按顺序执行）

```bash
# ① 环境变量（仓库根已提供模板，含 DB 账号与应用端口）
cp .env.example .env

# ② 后端环境变量（数据库连接串 + JWT 密钥）
cp backend/.env.example backend/.env
#    编辑 backend/.env：
#    DATABASE_URL="postgresql://bugtrace:<你的密码>@localhost:5432/bugtrace?schema=public"
#    JWT_SECRET="换成一段随机字符串"

# ③ 启动数据库容器（postgres:16）
docker compose up -d
docker compose ps          # 两个容器均应显示 healthy

# ④ 安装依赖 + 数据库迁移 + 种子账号
cd backend
npm install
npx prisma migrate dev     # 建表（含变更流转表）
npm run seed               # 写入默认账号（见第 4 节）

# ⑤ 可选：一键灌入演示数据（幂等可重跑，覆盖演示全场景）
npm run seed:demo

# ⑥ 启动后端（3000 端口，watch 模式）
npm run start:dev

# ⑦ 新开终端：启动前端（5173 端口）
cd ../frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:5173`，用第 4 节任一账号登录。

## 3. 启动 / 停止 / 看日志（三条核心命令）

```bash
docker compose up -d        # 启动（数据库 + app 容器）
docker compose down         # 停止（加 -v 连数据卷一起删，会清空数据库）
docker compose logs -f      # 看日志（-f app / -f postgres 只看单个）
```

> 说明：`app` 容器是占位保活进程（探测数据库连通）；实际后端以 `npm run start:dev` 在宿主机运行，便于热更新与调试。

## 4. 默认账号（npm run seed 写入）

| 账号 | 密码 | 角色 | 登录后可见 |
|---|---|---|---|
| admin | 123456 | ADMIN | 项目管理 / 需求管理 / 测试用例 / 测试计划 / 缺陷跟踪 / 变更流转 |
| qa | 123456 | QA | 测试用例 / 测试计划 / 缺陷跟踪 / 变更流转 |
| dev | 123456 | DEV | 缺陷跟踪（仅分派给自己的 Bug） |

演示数据（`seed:demo`）内容：1 项目（DEMO，三成员）+ 1 需求 + 3 用例（挂需求）+ 1 测试计划 + 7 条 Bug（6 状态全覆盖，含「回归失败重开」场景）+ 6 条变更单（CR 覆盖 9 个状态，含待回流 HOTFIX，流水分散近 14 天）。

## 5. 端口与 .env 说明

| 端口 | 用途 | 配置来源 |
|---|---|---|
| 5173 | 前端 Vite dev server | `frontend/vite.config.ts` |
| 3000 | 后端 API（Swagger 文档在 `/docs`） | `APP_PORT`（根 .env，容器映射）；本机直跑时为 3000 |
| 5432 | PostgreSQL | `DB_PORT`（根 .env） |

| 文件 | 作用 |
|---|---|
| `.env`（仓库根） | docker compose 用：DB 账号密码库名 + APP_PORT |
| `backend/.env` | Prisma 连接串 `DATABASE_URL` + `JWT_SECRET`（token 有效期 8h） |
| `frontend/.env.example` | 前端变量模板（当前无可选项，保留占位） |

本机开发时后端直连 `localhost:5432`（compose 已映射端口）；若后端放入 app 容器内运行，主机名改为 `postgres`。

## 6. 测试

```bash
cd backend && npm test            # 后端单测（状态机 37 条断言）
cd frontend && npm test           # 前端单测（Vitest）
```

## 7. 常见问题（FAQ）

**Q1：PowerShell 提示「无法加载文件 npm.ps1，因为在此系统上禁止运行脚本」？**
Windows 执行策略限制。用 `npm.cmd` / `npx.cmd` 代替（本仓库文档与脚本均按此写法），或以管理员执行 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`。

**Q2：`prisma generate` 报 EPERM（无法重命名 query_engine-windows.dll.node）？**
正在运行的后端 dev server 锁定了查询引擎 DLL。先停掉 `npm run start:dev`，执行 `npx prisma generate` 后再启动。仅在 `schema.prisma` 变更后需要重新 generate。

**Q3：`docker compose ps` 显示容器 unhealthy 或端口被占用？**
按顺序排查：① 确认 5432/3000 未被其他进程占用（`netstat -ano | findstr :5432`）；② Docker Desktop 已启动且 WSL2 后端正常；③ 首次启动等待 healthcheck 通过（约 10~20 秒）；④ 数据卷损坏时可 `docker compose down -v` 后重来（会清空数据，重跑第 2 节 ④⑤ 即可恢复）。

## 8. MVP 验收核对表（对应《BugTrace_MVP》1.3 节七条标准）

| # | 验收标准 | 结论 | 证据 |
|---|---|---|---|
| 1 | 三角色均可登录并看到各自视角页面 | ✅ 满足 | T4-2 走查步骤 0（三账号均取到 token）；浏览器实测：admin 菜单 6 项 / qa 4 项 / dev 仅「缺陷跟踪」 |
| 2 | ADMIN 能创建项目、邀请成员、登记需求 | ✅ 满足 | 走查步骤 1/2/3（demo-mall 项目 + 3 成员 + REQ）；T4-3 前修复验证：项目/需求编辑与删除（API 冒烟 16/16 + 浏览器实操） |
| 3 | QA 能提 Bug、分派给 DEV、执行回归、关闭 Bug | ✅ 满足 | 走查步骤 6a-6c（截图上传提单）/ 7（分派）/ 11-12（回归 + 关闭） |
| 4 | DEV 能看到分派给自己的 Bug、填修复、标记已修复 | ✅ 满足 | 走查步骤 8（服务端数据边界：列表 7 条全为 owner/fixer=dev）/ 9 / 10（修复三件套落库） |
| 5 | Bug 状态在 6 状态间正确流转，每步留操作记录 | ✅ 满足 | 状态机单测 37/37（含非法流转拦截）；走查步骤 12 流水时间轴 desc=close>verify>fix>start>assign；demo-seed 的 BUG-DEMO-0007 回归失败双留痕 |
| 6 | Bug 列表支持按状态、严重度、处理人筛选 | ✅ 满足 | 走查步骤 13（CLOSED=2 / CRITICAL=3 / owner=dev=7 与库中数据一致）；浏览器筛选「已关闭」联动验证 |
| 7 | 演示脚本（MVP 5.2 分镜）可完整走完不报错 | ✅ 满足 | T4-2 十四步走查 API 层 19/19 通过 + 三角色浏览器验证；异常分支 A（回归失败重开）/ B（拒绝）/ C（越权 403 全拦截）均通过 |

**豁免记录**：无。MVP 范围内七条全部满足。
**范围外增强（不计入本表）**：变更流转模块（CR 状态机 + 统计报表，T5 系列）为立项后追加需求，已单独验收：10 态状态机单测通过、统计接口与 DEMO 数据一致、页面浏览器实测通过。

## 9. 文档索引

| 文档 | 内容 |
|---|---|
| `../BugTrace_PRD.html` | 产品需求文档 V1.0（含变更流转第 7 章、18 条 AC） |
| `../BugTrace_TechPlan.html` | 技术方案 V1.0 |
| `../BugTrace_MVP.html` | MVP 范围定义 V0.1（1.3 节 = 验收七条） |
| `../BugTrace_CodexTasks.html` | 24 任务开发计划（T0~T4） |
| `../BugTrace_DevPlan.html` | 开发计划 |

## 10. 目录结构

```
bugtrace/
├── docker-compose.yml        # postgres + app 两容器
├── .env / .env.example       # compose 环境变量
├── backend/                  # NestJS 10 + Prisma
│   ├── .env                  # DATABASE_URL + JWT_SECRET
│   ├── prisma/schema.prisma  # 数据模型（含 change_request / change_log）
│   ├── prisma/seed.ts        # 默认账号种子
│   ├── prisma/demo-seed.ts   # 演示数据种子（幂等）
│   └── src/modules/          # auth/project/requirement/test-case/
│                             # test-plan/bug/attachment/change/health
└── frontend/                 # Vue 3 + Element Plus + ECharts
    └── src/views/            # 登录/项目/需求/用例/计划/Bug/变更流转
```
