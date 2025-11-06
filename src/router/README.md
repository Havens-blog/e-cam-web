# 路由系统

本目录包含 CAM 前端应用的路由配置。

## 文件说明

- `index.ts` - 路由器实例配置,包含路由守卫和全局钩子
- `routes.ts` - 路由表配置,定义所有页面路由
- `types.ts` - 路由相关的 TypeScript 类型定义

## 路由列表

### 主要页面

| 路径                 | 名称          | 组件                | 说明                  |
| -------------------- | ------------- | ------------------- | --------------------- |
| `/`                  | -             | -                   | 重定向到 `/dashboard` |
| `/dashboard`         | Dashboard     | dashboard/index.vue | 多云概览              |
| `/accounts`          | Accounts      | accounts/index.vue  | 云账号管理列表        |
| `/accounts/create`   | AccountCreate | accounts/form.vue   | 添加云账号            |
| `/accounts/:id/edit` | AccountEdit   | accounts/form.vue   | 编辑云账号            |
| `/assets`            | Assets        | assets/index.vue    | 资产管理列表          |
| `/assets/:id`        | AssetDetail   | assets/detail.vue   | 资产详情              |
| `/cost`              | Cost          | cost/index.vue      | 成本分析              |
| `/tasks`             | Tasks         | tasks/index.vue     | 任务管理列表          |
| `/tasks/:id`         | TaskDetail    | tasks/detail.vue    | 任务详情              |

### 错误页面

| 路径               | 名称     | 组件          | 说明     |
| ------------------ | -------- | ------------- | -------- |
| `/:pathMatch(.*)*` | NotFound | error/404.vue | 404 页面 |

## 路由元信息

每个路由可以配置以下元信息:

```typescript
interface RouteMeta {
  title?: string; // 页面标题
  icon?: string; // 图标名称
  hideInMenu?: boolean; // 是否在菜单中隐藏
  requiresAuth?: boolean; // 是否需要认证
  permissions?: string[]; // 权限标识
}
```

## 路由守卫

### 全局前置守卫 (beforeEach)

- 设置页面标题
- 可扩展认证检查逻辑

### 全局后置钩子 (afterEach)

- 记录页面访问日志
- 可扩展页面访问统计

## 使用示例

### 在组件中使用路由

```vue
<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

// 编程式导航
const goToAccounts = () => {
  router.push("/accounts");
};

// 获取路由参数
const assetId = route.params.id;
</script>
```

### 使用导航组合式函数

```vue
<script setup lang="ts">
import { useNavigation } from "@/composables/useNavigation";

const { goAccounts, goAssetDetail } = useNavigation();

// 导航到云账号管理
goAccounts();

// 导航到资产详情
goAssetDetail("123");
</script>
```

## 懒加载

所有路由组件都使用懒加载方式导入,以优化首屏加载性能:

```typescript
component: () => import("@/views/dashboard/index.vue");
```

## 滚动行为

路由切换时的滚动行为:

- 浏览器前进/后退时,恢复到之前的滚动位置
- 如果有锚点,滚动到锚点位置
- 否则滚动到页面顶部

## 扩展路由

添加新路由时,请在 `routes.ts` 中按照以下格式添加:

```typescript
{
  path: '/new-page',
  name: 'NewPage',
  component: () => import('@/views/new-page/index.vue'),
  meta: {
    title: '新页面',
    icon: 'Document',
  },
}
```
