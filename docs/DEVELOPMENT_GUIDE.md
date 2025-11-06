# 开发指南

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:5173

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

## 开发规范

### 组件开发

#### 组件命名

- 使用 PascalCase 命名组件文件
- 组件名应该是多个单词组成（除了根组件 App）

```vue
<!-- Good -->
<script setup lang="ts">
// UserCard.vue
</script>

<!-- Bad -->
<script setup lang="ts">
// user.vue
</script>
```

#### 组件结构

推荐的组件结构顺序：

```vue
<script setup lang="ts">
// 1. 导入
import { ref, computed } from "vue";
import type { User } from "@/api/types/user";

// 2. Props 定义
interface Props {
  user: User;
  showActions?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  showActions: true,
});

// 3. Emits 定义
interface Emits {
  (e: "edit", id: string): void;
  (e: "delete", id: string): void;
}
const emit = defineEmits<Emits>();

// 4. 响应式数据
const loading = ref(false);

// 5. 计算属性
const displayName = computed(() => props.user.name);

// 6. 方法
const handleEdit = () => {
  emit("edit", props.user.id);
};

// 7. 生命周期钩子
onMounted(() => {
  // 初始化逻辑
});
</script>

<template>
  <div class="user-card">
    <!-- 模板内容 -->
  </div>
</template>

<style scoped lang="scss">
.user-card {
  // 样式
}
</style>
```

### API 调用

#### 创建 API 函数

在 `src/api/` 目录下创建对应的 API 文件：

```typescript
// src/api/user.ts
import request from "./request";
import type { User, UserListParams, UserListResponse } from "./types/user";

/**
 * 获取用户列表
 */
export function getUserList(params: UserListParams) {
  return request.get<UserListResponse>("/users", { params });
}

/**
 * 获取用户详情
 */
export function getUserDetail(id: string) {
  return request.get<User>(`/users/${id}`);
}

/**
 * 创建用户
 */
export function createUser(data: Partial<User>) {
  return request.post<User>("/users", data);
}

/**
 * 更新用户
 */
export function updateUser(id: string, data: Partial<User>) {
  return request.put<User>(`/users/${id}`, data);
}

/**
 * 删除用户
 */
export function deleteUser(id: string) {
  return request.delete(`/users/${id}`);
}
```

#### 在组件中使用

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getUserList } from "@/api/user";
import type { User } from "@/api/types/user";

const users = ref<User[]>([]);
const loading = ref(false);

const fetchUsers = async () => {
  loading.value = true;
  try {
    const { data } = await getUserList({ page: 1, pageSize: 10 });
    users.value = data.items;
  } catch (error) {
    console.error("Failed to fetch users:", error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchUsers();
});
</script>
```

### 状态管理

#### 创建 Store

```typescript
// src/stores/user.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@/api/types/user";

export const useUserStore = defineStore(
  "user",
  () => {
    // State
    const currentUser = ref<User | null>(null);
    const token = ref<string>("");

    // Getters
    const isLoggedIn = computed(() => !!token.value);
    const userName = computed(() => currentUser.value?.name || "");

    // Actions
    function setUser(user: User) {
      currentUser.value = user;
    }

    function setToken(newToken: string) {
      token.value = newToken;
    }

    function logout() {
      currentUser.value = null;
      token.value = "";
    }

    return {
      currentUser,
      token,
      isLoggedIn,
      userName,
      setUser,
      setToken,
      logout,
    };
  },
  {
    persist: true, // 启用持久化
  }
);
```

#### 在组件中使用

```vue
<script setup lang="ts">
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();

// 访问状态
console.log(userStore.userName);

// 调用方法
userStore.logout();
</script>
```

### 路由开发

#### 添加新路由

在 `src/router/routes.ts` 中添加：

```typescript
{
  path: '/users',
  name: 'Users',
  component: () => import('@/views/users/index.vue'),
  meta: {
    title: '用户管理',
    icon: 'User',
  },
}
```

#### 路由导航

```vue
<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();

// 编程式导航
const goToUser = (id: string) => {
  router.push(`/users/${id}`);
};

// 或使用导航组合式函数
import { useNavigation } from "@/composables/useNavigation";
const { navigateTo } = useNavigation();

const goToUser = (id: string) => {
  navigateTo(`/users/${id}`);
};
</script>
```

### 样式开发

#### 使用 SCSS 变量

```vue
<style scoped lang="scss">
.user-card {
  padding: $spacing-md;
  background: $bg-color;
  border-radius: $border-radius-base;
  box-shadow: $box-shadow-base;

  .title {
    color: $text-primary;
    font-size: $font-size-large;
  }
}
</style>
```

#### 使用 SCSS 混入

```vue
<style scoped lang="scss">
.user-card {
  @include card;

  .header {
    @include flex-between;
  }

  .description {
    @include ellipsis;
  }
}
</style>
```

#### 响应式设计

```vue
<style scoped lang="scss">
.user-card {
  padding: $spacing-lg;

  @include respond-to("mobile") {
    padding: $spacing-md;
  }

  @include respond-to("tablet") {
    padding: $spacing-lg;
  }
}
</style>
```

### 工具函数

#### 创建工具函数

```typescript
// src/utils/date.ts
import dayjs from "dayjs";

/**
 * 格式化日期
 */
export function formatDate(
  date: string | Date,
  format = "YYYY-MM-DD HH:mm:ss"
) {
  return dayjs(date).format(format);
}

/**
 * 获取相对时间
 */
export function getRelativeTime(date: string | Date) {
  return dayjs(date).fromNow();
}
```

#### 使用工具函数

```vue
<script setup lang="ts">
import { formatDate } from "@/utils/date";

const createdAt = formatDate(user.createdAt);
</script>
```

### 组合式函数

#### 创建组合式函数

```typescript
// src/composables/usePagination.ts
import { ref, computed } from "vue";

export function usePagination(initialPage = 1, initialPageSize = 10) {
  const currentPage = ref(initialPage);
  const pageSize = ref(initialPageSize);
  const total = ref(0);

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value));

  const handlePageChange = (page: number) => {
    currentPage.value = page;
  };

  const handleSizeChange = (size: number) => {
    pageSize.value = size;
    currentPage.value = 1;
  };

  return {
    currentPage,
    pageSize,
    total,
    totalPages,
    handlePageChange,
    handleSizeChange,
  };
}
```

#### 使用组合式函数

```vue
<script setup lang="ts">
import { usePagination } from "@/composables/usePagination";

const { currentPage, pageSize, total, handlePageChange, handleSizeChange } =
  usePagination();
</script>
```

## 调试技巧

### Vue DevTools

安装 Vue DevTools 浏览器扩展，可以：

- 查看组件树
- 检查组件状态
- 查看 Pinia store
- 追踪事件
- 性能分析

### 控制台调试

```typescript
// 开发环境下的调试日志
if (import.meta.env.DEV) {
  console.log("Debug info:", data);
}
```

### 网络请求调试

在浏览器开发者工具的 Network 标签中查看：

- 请求 URL
- 请求方法
- 请求头
- 请求体
- 响应状态
- 响应数据

## 性能优化

### 组件懒加载

```typescript
// 路由懒加载
const UserList = () => import("@/views/users/index.vue");

// 组件懒加载
const HeavyComponent = defineAsyncComponent(
  () => import("@/components/HeavyComponent.vue")
);
```

### 列表虚拟滚动

对于大量数据的列表，使用虚拟滚动：

```vue
<template>
  <el-table-v2 :columns="columns" :data="data" :width="700" :height="400" />
</template>
```

### 图片优化

```vue
<template>
  <!-- 使用懒加载 -->
  <el-image :src="imageUrl" lazy :preview-src-list="[imageUrl]" />
</template>
```

## 常见问题

### 1. 环境变量不生效

- 确保变量名以 `VITE_` 开头
- 修改环境变量后需要重启开发服务器

### 2. 样式不生效

- 检查是否正确导入了全局样式
- 确认 scoped 样式的作用域
- 检查 CSS 选择器优先级

### 3. 路由跳转失败

- 检查路由配置是否正确
- 确认路由路径拼写
- 查看控制台错误信息

### 4. API 请求失败

- 检查网络连接
- 确认 API 地址配置
- 查看请求和响应数据
- 检查跨域配置

## 最佳实践

1. **组件拆分**：保持组件单一职责，复杂组件拆分为多个小组件
2. **类型安全**：充分利用 TypeScript 类型系统
3. **错误处理**：统一的错误处理机制
4. **代码复用**：提取公共逻辑为组合式函数
5. **性能优化**：合理使用懒加载和缓存
6. **代码规范**：遵循 ESLint 规则
7. **注释文档**：为复杂逻辑添加注释
8. **测试覆盖**：编写必要的单元测试

## 参考资源

- [Vue 3 官方文档](https://cn.vuejs.org/)
- [Vite 官方文档](https://cn.vitejs.dev/)
- [Element Plus 官方文档](https://element-plus.org/zh-CN/)
- [Pinia 官方文档](https://pinia.vuejs.org/zh/)
- [Vue Router 官方文档](https://router.vuejs.org/zh/)
- [TypeScript 官方文档](https://www.typescriptlang.org/zh/)
