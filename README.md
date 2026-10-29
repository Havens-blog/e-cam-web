# CAM Web - 多云资产管理系统前端

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Vue](https://img.shields.io/badge/Vue-3.5+-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

基于 Vue 3 + TypeScript + Vite + Element Plus 的多云资产管理系统前端应用

[功能特性](#功能特性) • [快速开始](#快速开始) • [文档](#文档) • [部署](#部署)

</div>

## 📋 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [构建部署](#构建部署)
- [环境变量](#环境变量)
- [文档](#文档)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

## 项目简介

CAM (Cloud Asset Management) Web 是一个现代化的多云资产管理系统前端应用，旨在帮助企业统一管理和监控多个云平台（阿里云、AWS、Azure、腾讯云、华为云）的资源和成本。

### 主要目标

- 🎯 **统一管理**：集中管理多个云平台账号和资源
- 📊 **可视化监控**：实时监控资源状态和成本趋势
- 💰 **成本优化**：分析和优化云资源成本
- 🔄 **任务追踪**：异步任务执行状态追踪
- 🛡️ **安全可靠**：完善的错误处理和日志记录

## 功能特性

### 核心功能

- ✅ **多云概览**

  - 资产统计（总数、运行中、已停止）
  - 成本趋势图表
  - 云厂商分布
  - 环境分布统计

- ✅ **云账号管理**

  - 多云平台账号管理（阿里云、AWS、Azure、腾讯云、华为云）
  - 账号连接状态监控
  - 账号凭证管理
  - 账号启用/禁用

- ✅ **资产管理**

  - 资产列表查看
  - 多维度筛选（云厂商、资产类型、区域、状态）
  - 资产详情查看
  - 资产搜索

- ✅ **成本分析**

  - 成本趋势分析
  - 成本分解（按云厂商、资产类型）
  - 时间范围选择
  - 成本图表可视化

- ✅ **任务管理**
  - 任务列表查看
  - 任务状态追踪
  - 任务详情查看
  - 任务取消/删除

### 技术特性

- 🚀 **现代化技术栈**：Vue 3 + TypeScript + Vite
- 📦 **组件化开发**：可复用的组件库
- 🎨 **响应式设计**：适配多种屏幕尺寸
- 🔐 **状态管理**：Pinia + 持久化
- 🌐 **路由管理**：Vue Router + 路由守卫
- 📡 **API 管理**：Axios + 拦截器
- 🎯 **错误处理**：统一错误处理和日志记录
- 🐳 **容器化部署**：Docker + Docker Compose

## 技术栈

### 核心框架

- **[Vue 3.5+](https://vuejs.org/)** - 渐进式 JavaScript 框架
- **[TypeScript 5.9+](https://www.typescriptlang.org/)** - JavaScript 的超集
- **[Vite 7+](https://vitejs.dev/)** - 下一代前端构建工具

### UI 和样式

- **[Element Plus 2.10+](https://element-plus.org/)** - Vue 3 组件库
- **[ECharts 5.5+](https://echarts.apache.org/)** - 数据可视化图表库
- **[SCSS](https://sass-lang.com/)** - CSS 预处理器

### 状态和路由

- **[Pinia 3.0+](https://pinia.vuejs.org/)** - Vue 状态管理
- **[Vue Router 4.5+](https://router.vuejs.org/)** - Vue 路由管理

### 工具库

- **[Axios 1.6+](https://axios-http.com/)** - HTTP 客户端
- **[Day.js](https://day.js.org/)** - 日期处理库

### 开发工具

- **[ESLint](https://eslint.org/)** - 代码检查工具
- **[pnpm](https://pnpm.io/)** - 快速的包管理器

## 项目结构

```
cam-web/
├── public/                 # 静态资源
├── src/
│   ├── api/               # API 接口
│   │   ├── index.ts       # API 导出
│   │   ├── request/       # 请求配置
│   │   └── types/         # 类型定义
│   ├── assets/            # 资源文件
│   │   └── styles/        # 全局样式
│   ├── components/        # 共享组件
│   │   ├── ChartCard.vue
│   │   ├── StatCard.vue
│   │   └── ...
│   ├── composables/       # 组合式函数
│   │   ├── useStores.ts
│   │   └── useNavigation.ts
│   ├── config/            # 配置文件
│   │   └── index.ts
│   ├── plugins/           # 插件
│   │   └── error-handler.ts
│   ├── router/            # 路由配置
│   │   ├── index.ts
│   │   └── routes.ts
│   ├── stores/            # 状态管理
│   │   ├── user.ts
│   │   ├── account.ts
│   │   ├── asset.ts
│   │   └── app.ts
│   ├── utils/             # 工具函数
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── ...
│   ├── views/             # 页面组件
│   │   ├── dashboard/     # 多云概览
│   │   ├── accounts/      # 云账号管理
│   │   ├── assets/        # 资产管理
│   │   ├── cost/          # 成本分析
│   │   └── tasks/         # 任务管理
│   ├── App.vue            # 根组件
│   └── main.ts            # 入口文件
├── docs/                  # 文档
│   ├── DEVELOPMENT_GUIDE.md
│   ├── DEPLOYMENT.md
│   └── DOCKER_DEPLOYMENT.md
├── .env                   # 环境变量
├── .env.development       # 开发环境变量
├── .env.production        # 生产环境变量
├── Dockerfile             # Docker 配置
├── docker-compose.yml     # Docker Compose 配置
├── nginx.conf             # Nginx 配置
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
└── vite.config.ts         # Vite 配置
```

详细的项目结构说明请参考 [项目结构文档](./docs/PROJECT_STRUCTURE.md)。

## 快速开始

### 前置要求

- Node.js 18+
- pnpm 8+
- Git

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd cam-web

# 安装依赖
pnpm install
```

### 开发

```bash
# 启动开发服务器
pnpm dev

# 开发服务器将在 http://localhost:5173 启动
# 访问应用: http://localhost:5173/cam/dashboard
```

> **多实例 / 验证实例务必隔离依赖缓存（否则页面会 `504 Outdated Optimize Dep` 打不开）**
>
> Vite 把依赖预打包结果写在 `cacheDir`（默认 `node_modules/.vite/deps`）。若**同一份
> `node_modules` 上跑了两个以上 vite 实例**（主 dev server + 工作树验证实例，或用目录
> 联接共享 `node_modules`），后启动的实例会**重写同一份 deps**，先启动实例已在浏览器里
> 加载的依赖 URL（`…/deps/xxx.js?v=<旧hash>`）随之失效 → 页面报
> `504 Outdated Optimize Dep`，且**普通刷新无效**（服务端内存元数据仍指向已被替换的
> 文件），**必须重启该 dev server**。
>
> 规避：验证实例用独立配置指向**独立 cacheDir**（必要时另开端口）：
>
> ```ts
> // vite.verify.config.ts（工作树内本地文件，不入库）
> import { defineConfig } from 'vite'
> import baseConfig from './vite.config'
>
> export default defineConfig(async (env) => {
>   const base = typeof baseConfig === 'function' ? await baseConfig(env) : baseConfig
>   return {
>     ...base,
>     cacheDir: 'node_modules/.vite-verify', // 与主实例的 .vite 分离
>     server: { ...(base as any).server, port: 3333, open: false },
>   }
> })
> ```
>
> 启动：`npx vite --config vite.verify.config.ts`
>
> **不要覆盖 `server.fs.allow`**（实测踩坑，2026-10-29）：曾按"允许工作树路径"写成
> `fs: { allow: [process.cwd(), ...] }`，但 `process.cwd()` 在 `npx` 启动链路下**不一定等于
> 项目根**，于是 Vite 认为项目文件不在白名单内：轻则**直接回原文件**（浏览器报
> `Failed to resolve module specifier "vue"`，因 TS 未被转换、裸导入未被重写），重则页面
> 直接 **403 Forbidden**。默认（不写 `fs.allow`）已允许项目根与工作区根，够用；确需放开
> 其它目录时请写**绝对字面路径**，不要依赖 `process.cwd()`。

**注意**: 所有页面路由都使用 `/cam` 前缀，例如：

- 多云概览: `http://localhost:5173/cam/dashboard`
- 云账号管理: `http://localhost:5173/cam/accounts`
- 资产管理: `http://localhost:5173/cam/assets`
- 成本分析: `http://localhost:5173/cam/cost`
- 任务管理: `http://localhost:5173/cam/tasks`

### 构建

```bash
# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

### 代码检查

```bash
# 运行 ESLint
pnpm lint
```

## 开发指南

### 开发环境配置

1. **配置环境变量**

创建 `.env.development.local` 文件：

```bash
# API 基础 URL
VITE_API_BASE_URL=/api

# 应用标题
VITE_APP_TITLE=CAM 多云资产管理 - 开发环境
```

2. **配置 API 代理**

在 `vite.config.ts` 中配置代理：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
}
```

3. **启动开发服务器**

```bash
pnpm dev
```

### 开发规范

- 使用 TypeScript 进行类型检查
- 使用 ESLint 进行代码规范检查
- 使用 Composition API 编写组件
- 使用 SCSS 编写样式
- 使用 `@` 别名引用 `src` 目录
- 组件命名使用 PascalCase
- 文件命名使用 kebab-case

详细的开发指南请参考 [开发指南文档](./docs/DEVELOPMENT_GUIDE.md)。

## 构建部署

### 生产构建

```bash
# 构建生产版本
pnpm build

# 构建产物在 dist 目录
```

### Docker 部署

```bash
# 构建 Docker 镜像
docker build -t cam-web:latest .

# 运行容器
docker run -d -p 8080:80 --name cam-web cam-web:latest

# 或使用 Docker Compose
docker-compose up -d
```

### Nginx 部署

将 `dist` 目录的内容部署到 Nginx 服务器：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend-service:8080/;
    }
}
```

详细的部署指南请参考：

- [部署指南](./docs/DEPLOYMENT.md)
- [Docker 部署指南](./docs/DOCKER_DEPLOYMENT.md)

## 环境变量

### 应用环境变量

| 变量名              | 说明               | 默认值             | 示例                      |
| ------------------- | ------------------ | ------------------ | ------------------------- |
| `VITE_APP_TITLE`    | 应用标题           | `CAM 多云资产管理` | `CAM 多云资产管理`        |
| `VITE_API_BASE_URL` | API 基础 URL       | `/api`             | `https://api.example.com` |
| `VITE_USE_MOCK`     | 是否使用 Mock 数据 | `false`            | `true` / `false`          |
| `VITE_PORT`         | 开发服务器端口     | `5173`             | `3000`                    |

### 环境文件

- `.env` - 所有环境通用配置
- `.env.development` - 开发环境配置
- `.env.production` - 生产环境配置
- `.env.local` - 本地配置（不提交到 Git）

## 文档

- [开发指南](./docs/DEVELOPMENT_GUIDE.md) - 详细的开发指南
- [项目结构](./docs/PROJECT_STRUCTURE.md) - 项目结构说明
- [部署指南](./docs/DEPLOYMENT.md) - 部署指南
- [Docker 部署](./docs/DOCKER_DEPLOYMENT.md) - Docker 部署指南
- [API 文档](./src/api/README.md) - API 接口文档
- [状态管理](./src/stores/README.md) - 状态管理文档

## 常见问题

### 1. 安装依赖失败

```bash
# 清除缓存后重新安装
pnpm store prune
pnpm install
```

### 2. 开发服务器启动失败

检查端口是否被占用：

```bash
# Windows
netstat -ano | findstr :5173

# Linux/Mac
lsof -i :5173
```

### 3. 构建失败

```bash
# 清除缓存后重新构建
rm -rf node_modules dist
pnpm install
pnpm build
```

### 4. API 请求失败

检查 API 代理配置和后端服务是否正常运行。

## 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目主页: <repository-url>
- 问题反馈: <repository-url>/issues

---

<div align="center">
Made with ❤️ by CAM Team
</div>
