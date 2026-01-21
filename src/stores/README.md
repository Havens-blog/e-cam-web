# 状态管理

本项目使用 Pinia 进行状态管理，并配置了持久化插件。

## Store 模块

### 1. User Store (用户状态)

管理用户登录状态、用户信息和权限。

```typescript
import { useUserStore } from "@/stores/user";

const userStore = useUserStore();

// 登录
userStore.login(token, userInfo);

// 登出
userStore.logout();

// 检查权限
if (userStore.hasPermission("account:create")) {
  // 有权限
}

// 检查角色
if (userStore.hasRole("admin")) {
  // 是管理员
}
```

**持久化配置**：

- 存储位置：localStorage
- 持久化字段：token, userInfo, isLoggedIn

### 2. Account Store (云账号状态)

管理云账号列表和当前选中的账号。

```typescript
import { useAccountStore } from "@/stores/account";

const accountStore = useAccountStore();

// 设置账号列表
accountStore.setAccounts(accounts);

// 添加账号
accountStore.addAccount(newAccount);

// 更新账号
accountStore.updateAccount(accountId, { status: "active" });

// 删除账号
accountStore.removeAccount(accountId);

// 获取账号
const account = accountStore.getAccountById(accountId);

// 按云厂商获取账号
const awsAccounts = accountStore.getAccountsByProvider("aws");

// 计算属性
console.log("活跃账号数:", accountStore.activeAccounts.length);
console.log("错误账号数:", accountStore.errorAccounts.length);
```

**持久化配置**：

- 存储位置：sessionStorage
- 持久化字段：accounts

### 3. Asset Store (资产状态)

管理资产列表、筛选条件和分页信息。

```typescript
import { useAssetStore } from "@/stores/asset";

const assetStore = useAssetStore();

// 设置资产列表
assetStore.setAssets(assets);

// 设置筛选条件
assetStore.setFilters({
  provider: "aws",
  assetType: "ecs",
  status: "running",
});

// 获取筛选后的资产
const filtered = assetStore.filteredAssets;

// 分页
assetStore.setCurrentPage(2);
assetStore.setPageSize(50);

// 按状态分组
const grouped = assetStore.assetsByStatus;
```

**持久化配置**：

- 存储位置：sessionStorage
- 持久化字段：filters, pageSize

### 4. App Store (应用配置)

管理应用级别的配置，如主题、语言等。

```typescript
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();

// 设置主题
appStore.setTheme("dark");

// 切换主题
appStore.toggleTheme();

// 设置语言
appStore.setLanguage("en-US");

// 设置页面标题
appStore.setPageTitle("云账号管理");

// 侧边栏
appStore.toggleSidebar();
```

**持久化配置**：

- 存储位置：localStorage
- 持久化字段：theme, language, sidebarCollapsed

## 使用方式

### 方式一：直接导入

```typescript
import { useUserStore } from "@/stores/user";

export default {
  setup() {
    const userStore = useUserStore();

    return {
      userStore,
    };
  },
};
```

### 方式二：使用组合式函数

```typescript
import { useStores } from "@/composables/useStores";

export default {
  setup() {
    const { userStore, accountStore, assetStore, appStore } = useStores();

    return {
      userStore,
      accountStore,
    };
  },
};
```

### 方式三：使用便捷方法

```typescript
import { useUser, useAccount } from "@/composables/useStores";

export default {
  setup() {
    const userStore = useUser();
    const accountStore = useAccount();

    return {
      userStore,
      accountStore,
    };
  },
};
```

## 持久化说明

本项目使用 `pinia-plugin-persistedstate` 插件实现状态持久化。

### 存储策略

- **localStorage**：用于需要长期保存的数据（如用户信息、主题设置）
- **sessionStorage**：用于会话期间的数据（如账号列表、资产列表）

### 清除持久化数据

```typescript
// 清除所有持久化数据
localStorage.clear();
sessionStorage.clear();

// 清除特定 store 的数据
localStorage.removeItem("cam-user");
sessionStorage.removeItem("cam-accounts");
```

## 最佳实践

1. **在组件中使用 store**：优先在 `setup()` 函数中使用
2. **避免直接修改状态**：使用提供的方法来修改状态
3. **使用计算属性**：对于需要派生的数据，使用 store 中的计算属性
4. **合理使用持久化**：只持久化必要的数据，避免存储过多数据
5. **清理数据**：在适当的时机清理不需要的数据（如登出时）

## 注意事项

1. Store 中的状态是响应式的，可以直接在模板中使用
2. 持久化的数据会在页面刷新后自动恢复
3. sessionStorage 中的数据在关闭标签页后会被清除
4. 敏感信息（如密码）不应该存储在 store 中
