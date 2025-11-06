# CAM Web - 多云资产管理系统前端

基于 Vue 3 + TypeScript + Vite + Element Plus 的多云资产管理系统前端应用。

## 技术栈

- **框架**: Vue 3.5+ (Composition API)
- **构建工具**: Vite 7+
- **UI 组件库**: Element Plus 2.10+
- **状态管理**: Pinia 3.0+
- **路由**: Vue Router 4.5+
- **HTTP 客户端**: Axios 1.6+
- **图表库**: ECharts 5.5+
- **样式**: SCSS
- **包管理器**: pnpm

## 项目结构

```
cam-web/
├── public/              # 静态资源
├── src/
│   ├── api/            # API接口
│   ├── assets/         # 资源文件
│   ├── components/     # 共享组件
│   ├── composables/    # 组合式函数
│   ├── router/         # 路由配置
│   ├── stores/         # 状态管理
│   ├── utils/          # 工具函数
│   ├── views/          # 页面组件
│   ├── App.vue         # 根组件
│   └── main.ts         # 入口文件
├── .env                # 环境变量
├── .env.development    # 开发环境变量
├── .env.production     # 生产环境变量
└── vite.config.ts      # Vite配置
```

## 开发指南

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

开发服务器将在 http://localhost:5173 启动

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

### 代码检查

```bash
pnpm lint
```

## 环境变量

- `VITE_APP_TITLE`: 应用标题
- `VITE_API_BASE_URL`: API 基础 URL

## 功能模块

- 多云概览 - 资产统计和成本趋势
- 云账号管理 - 管理多云平台账号
- 资产管理 - 查看和管理云资产
- 成本分析 - 成本趋势和分解分析
- 任务管理 - 异步任务跟踪

## 开发规范

- 使用 TypeScript 进行类型检查
- 使用 ESLint 进行代码规范检查
- 使用 Composition API 编写组件
- 使用 SCSS 编写样式
- 使用 @ 别名引用 src 目录
