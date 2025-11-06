# 项目结构说明

## 目录结构

```
cam-web/
├── .vscode/                  # VSCode 配置
│   └── extensions.json      # 推荐的扩展
├── docs/                    # 项目文档
│   └── PROJECT_STRUCTURE.md # 项目结构说明
├── public/                  # 静态资源
│   └── vite.svg            # 网站图标
├── src/                     # 源代码
│   ├── api/                # API 接口
│   │   ├── request/        # 请求封装
│   │   │   ├── index.ts   # Axios 实例
│   │   │   └── types.ts   # 请求类型
│   │   ├── types/          # API 类型定义
│   │   │   ├── account.ts # 云账号类型
│   │   │   ├── asset.ts   # 资产类型
│   │   │   ├── cost.ts    # 成本类型
│   │   │   ├── field.ts   # 字段类型
│   │   │   ├── model.ts   # 模型类型
│   │   │   └── task.ts    # 任务类型
│   │   └── index.ts        # API 导出
│   ├── assets/             # 资源文件
│   │   └── styles/         # 全局样式
│   │       ├── index.scss      # 主样式文件
│   │       ├── variables.scss  # SCSS 变量
│   │       └── mixins.scss     # SCSS 混入
│   ├── components/         # 共享组件
│   │   ├── ChartCard.vue          # 图表卡片
│   │   ├── EnvironmentTag.vue     # 环境标签
│   │   ├── ProviderIcon.vue       # 云厂商图标
│   │   ├── StatCard.vue           # 统计卡片
│   │   ├── ManagerHeader/         # 管理页头部
│   │   └── PageContainer/         # 页面容器
│   ├── composables/        # 组合式函数
│   │   └── useNavigation.ts # 导航相关
│   ├── router/             # 路由配置
│   │   ├── index.ts        # 路由实例
│   │   ├── routes.ts       # 路由表
│   │   ├── types.ts        # 路由类型
│   │   └── README.md       # 路由文档
│   ├── stores/             # 状态管理
│   │   └── index.ts        # Pinia 实例
│   ├── utils/              # 工具函数
│   │   ├── api-validator.ts    # API 验证
│   │   ├── cache-manager.ts    # 缓存管理
│   │   ├── chart-options.ts    # 图表配置
│   │   ├── constants.ts        # 常量定义
│   │   ├── error-handler.ts    # 错误处理
│   │   ├── error-logger.ts     # 错误日志
│   │   ├── formatters.ts       # 格式化工具
│   │   └── validators.ts       # 验证工具
│   ├── views/              # 页面组件
│   │   ├── accounts/       # 云账号管理
│   │   ├── assets/         # 资产管理
│   │   ├── cost/           # 成本分析
│   │   ├── dashboard/      # 多云概览
│   │   ├── error/          # 错误页面
│   │   └── tasks/          # 任务管理
│   ├── App.vue             # 根组件
│   ├── main.ts             # 入口文件
│   └── env.d.ts            # 环境类型声明
├── .env                     # 环境变量（所有环境）
├── .env.development         # 开发环境变量
├── .env.production          # 生产环境变量
├── .eslintignore            # ESLint 忽略配置
├── .eslintrc.cjs            # ESLint 配置
├── .gitignore               # Git 忽略配置
├── index.html               # HTML 模板
├── package.json             # 项目依赖
├── pnpm-lock.yaml           # 依赖锁定文件
├── README.md                # 项目说明
├── tsconfig.json            # TypeScript 配置
├── tsconfig.app.json        # 应用 TS 配置
├── tsconfig.node.json       # Node TS 配置
└── vite.config.ts           # Vite 配置
```

## 核心配置文件说明

### package.json

项目依赖和脚本配置：

- `dev`: 启动开发服务器
- `build`: 构建生产版本
- `preview`: 预览生产构建
- `lint`: 运行 ESLint 检查

### vite.config.ts

Vite 构建工具配置：

- 插件配置（Vue、自动导入、组件自动注册）
- 路径别名（@指向 src 目录）
- 开发服务器配置（端口、代理）
- SCSS 全局变量配置
- 生产构建优化（代码分割、压缩）

### tsconfig.json

TypeScript 配置：

- 严格模式启用
- 路径别名配置
- Vue 文件支持

### .eslintrc.cjs

ESLint 代码规范配置：

- Vue 3 规则
- TypeScript 规则
- 自定义规则覆盖

## 环境变量

### .env

所有环境共享的变量：

- `VITE_APP_TITLE`: 应用标题
- `VITE_API_BASE_URL`: API 基础路径

### .env.development

开发环境特定变量：

- `VITE_USE_MOCK`: 是否使用 Mock 数据
- `VITE_PORT`: 开发服务器端口

### .env.production

生产环境特定变量：

- `VITE_API_BASE_URL`: 生产环境 API 地址

## 样式系统

### variables.scss

定义了项目中使用的所有 SCSS 变量：

- 颜色变量（主题色、状态色、文本色等）
- 间距变量
- 字体变量
- 阴影变量
- 云厂商品牌色
- 环境标识色

### mixins.scss

定义了常用的 SCSS 混入：

- 布局相关（flex、居中）
- 文本处理（省略号）
- 响应式断点
- 过渡动画
- 滚动条样式

### index.scss

全局样式文件：

- 样式重置
- 工具类
- 通用组件样式

## 开发规范

### 命名规范

- 组件文件：PascalCase（如 `UserCard.vue`）
- 工具函数：camelCase（如 `formatDate.ts`）
- 常量：UPPER_SNAKE_CASE（如 `API_BASE_URL`）
- CSS 类名：kebab-case（如 `user-card`）

### 目录规范

- 每个功能模块独立目录
- 组件相关文件放在同一目录
- 共享代码放在对应的共享目录

### 代码规范

- 使用 TypeScript 严格模式
- 使用 Composition API
- 遵循 ESLint 规则
- 添加必要的注释

## 技术栈

### 核心框架

- Vue 3.5+ - 渐进式 JavaScript 框架
- TypeScript 5.9+ - JavaScript 的超集
- Vite 7+ - 下一代前端构建工具

### UI 组件库

- Element Plus 2.10+ - Vue 3 组件库

### 状态管理

- Pinia 3+ - Vue 状态管理库

### 路由

- Vue Router 4+ - Vue 官方路由

### HTTP 客户端

- Axios 1.6+ - Promise 基于的 HTTP 客户端

### 图表库

- ECharts 5+ - 数据可视化图表库

### 样式

- SCSS - CSS 预处理器

### 开发工具

- ESLint - 代码检查工具
- unplugin-auto-import - 自动导入 API
- unplugin-vue-components - 自动导入组件

## 开发流程

1. 安装依赖：`pnpm install`
2. 启动开发服务器：`pnpm dev`
3. 代码检查：`pnpm lint`
4. 构建生产版本：`pnpm build`
5. 预览生产构建：`pnpm preview`

## 注意事项

1. 所有环境变量必须以 `VITE_` 开头
2. 使用 `@/` 别名引用 src 目录下的文件
3. SCSS 变量和混入已全局注入，可直接使用
4. 组件会自动注册，无需手动导入
5. Vue API 会自动导入，无需手动导入
