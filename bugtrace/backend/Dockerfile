# BugTrace 后端生产镜像
# 构建阶段：安装依赖、生成 Prisma Client、编译 NestJS
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# 运行阶段：仅保留产物与运行依赖
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# 容器内 uploads 目录（挂载数据盘 /data/bugtrace/uploads）
RUN mkdir -p /app/uploads

EXPOSE 3000

# 启动时自动应用迁移、灌入种子、运行服务
CMD ["sh", "-c", "npx prisma migrate deploy && npm run seed && npm run start:prod"]
