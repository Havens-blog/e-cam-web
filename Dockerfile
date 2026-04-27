# 多阶段构建 Dockerfile for CAM Web

# 阶段 1: 构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm
RUN npm install -g pnpm

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm run build

# 阶段 2: 生产阶段
FROM nginx:alpine

# 安装 tzdata 用于时区设置
RUN apk add --no-cache tzdata

# 设置时区为上海
ENV TZ=Asia/Shanghai

# 复制简化版 nginx 配置（API 代理由 ecmdb-web 统一处理）
COPY nginx.cam.conf /etc/nginx/nginx.conf

# 从构建阶段复制构建产物到 /cam/ 子目录（对应 vite base: '/cam/'）
COPY --from=builder /app/dist /usr/share/nginx/html/cam

# 创建日志目录
RUN mkdir -p /var/log/nginx

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# 启动 nginx
CMD ["nginx", "-g", "daemon off;"]
