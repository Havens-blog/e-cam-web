# API 接口文档

## 概述

本目录包含所有与后端 API 交互的接口定义和类型声明。

## 目录结构

```
api/
├── request/              # HTTP 请求封装
│   ├── index.ts         # HttpRequest 类
│   ├── service.ts       # 服务实例配置
│   └── types.ts         # 请求相关类型
├── types/               # API 类型定义
│   ├── account.ts       # 云账号相关类型
│   ├── asset.ts         # 资产相关类型
│   ├── cost.ts          # 成本分析类型
│   ├── field.ts         # 字段管理类型
│   ├── model.ts         # 模型管理类型
│   ├── statistics.ts    # 统计数据类型
│   └── task.ts          # 任务管理类型
├── index.ts             # API 接口导出
└── README.md            # 本文档
```

## 使用方式

### 基本用法

```typescript
import { listCloudAccountsApi } from "@/api";

// 调用 API
const fetchAccounts = async () => {
  try {
    const { data } = await listCloudAccountsApi({
      page: 1,
      page_size: 10,
    });
    console.log(data);
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
  }
};
```

### 在组件中使用

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { listCloudAccountsApi } from "@/api";
import type { CloudAccount } from "@/api/types/account";

const accounts = ref<CloudAccount[]>([]);
const loading = ref(false);

const fetchAccounts = async () => {
  loading.value = true;
  try {
    const { data } = await listCloudAccountsApi({
      page: 1,
      page_size: 10,
    });
    accounts.value = data.items;
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchAccounts();
});
</script>
```

## API 分类

### 1. 云账号管理 API

#### 查询云账号列表

```typescript
listCloudAccountsApi(params: ListAccountsParams): Promise<ListAccountsResponse>
```

#### 创建云账号

```typescript
createCloudAccountApi(data: CreateAccountRequest): Promise<CreateAccountResponse>
```

#### 更新云账号

```typescript
updateCloudAccountApi(id: number, data: UpdateAccountRequest): Promise<void>
```

#### 删除云账号

```typescript
deleteCloudAccountApi(id: number): Promise<void>
```

#### 获取云账号详情

```typescript
getCloudAccountApi(id: number): Promise<CloudAccount>
```

#### 测试云账号连接

```typescript
testConnectionApi(id: number): Promise<TestConnectionResponse>
```

#### 启用云账号

```typescript
enableCloudAccountApi(id: number): Promise<void>
```

#### 禁用云账号

```typescript
disableCloudAccountApi(id: number): Promise<void>
```

#### 同步云账号资产

```typescript
syncCloudAccountApi(id: number, data: SyncRequest): Promise<SyncResponse>
```

### 2. 资产管理 API

#### 查询资产列表

```typescript
listAssetsApi(params: ListAssetsParams): Promise<ListAssetsResponse>
```

#### 获取资产详情

```typescript
getAssetDetailApi(id: number): Promise<AssetDetail>
```

#### 更新资产信息

```typescript
updateAssetApi(data: UpdateAssetRequest): Promise<void>
```

#### 删除资产

```typescript
deleteAssetApi(id: number): Promise<void>
```

#### 发现资产

```typescript
discoverAssetsApi(data: DiscoverRequest): Promise<DiscoverResponse>
```

#### 批量创建资产

```typescript
createMultiAssetsApi(data: CreateMultiAssetsRequest): Promise<CreateMultiAssetsResponse>
```

#### 同步资产

```typescript
syncAssetsApi(data: SyncAssetsRequest): Promise<SyncAssetsResponse>
```

### 3. 统计 API

#### 获取统计数据

```typescript
getStatisticsApi(): Promise<StatisticsResponse>
```

### 4. 成本分析 API

#### 获取成本分析数据

```typescript
getCostAnalysisApi(params: CostAnalysisParams): Promise<CostAnalysisResponse>
```

### 5. 任务管理 API

#### 获取任务列表

```typescript
listTasksApi(params: ListTasksParams): Promise<TaskListResponse>
```

#### 获取任务详情

```typescript
getTaskDetailApi(id: string): Promise<TaskDetailResponse>
```

#### 提交同步资产任务

```typescript
submitSyncAssetsTaskApi(data: SubmitSyncAssetsTaskRequest): Promise<SubmitTaskResponse>
```

#### 提交发现资产任务

```typescript
submitDiscoverAssetsTaskApi(data: SubmitDiscoverAssetsTaskRequest): Promise<SubmitTaskResponse>
```

#### 取消任务

```typescript
cancelTaskApi(id: string): Promise<void>
```

#### 删除任务

```typescript
deleteTaskApi(id: string): Promise<void>
```

### 6. 模型管理 API

#### 获取模型列表

```typescript
listModelsApi(params: ListModelsParams): Promise<ListModelsResponse>
```

#### 获取模型详情

```typescript
getModelDetailApi(uid: string): Promise<Model>
```

#### 创建模型

```typescript
createModelApi(data: CreateModelRequest): Promise<Model>
```

#### 更新模型

```typescript
updateModelApi(uid: string, data: UpdateModelRequest): Promise<Model>
```

#### 删除模型

```typescript
deleteModelApi(uid: string): Promise<void>
```

### 7. 字段管理 API

#### 获取模型字段列表

```typescript
listModelFieldsApi(modelUid: string): Promise<ModelField[]>
```

#### 创建字段

```typescript
createFieldApi(modelUid: string, data: CreateFieldRequest): Promise<ModelField>
```

#### 更新字段

```typescript
updateFieldApi(fieldUid: string, data: UpdateFieldRequest): Promise<void>
```

#### 删除字段

```typescript
deleteFieldApi(fieldUid: string): Promise<void>
```

#### 获取字段分组列表

```typescript
listFieldGroupsApi(modelUid: string): Promise<ModelFieldGroup[]>
```

#### 创建字段分组

```typescript
createFieldGroupApi(modelUid: string, data: CreateFieldGroupRequest): Promise<ModelFieldGroup>
```

#### 更新字段分组

```typescript
updateFieldGroupApi(id: number, data: UpdateFieldGroupRequest): Promise<void>
```

#### 删除字段分组

```typescript
deleteFieldGroupApi(id: number): Promise<void>
```

## 响应格式

### 标准响应格式

```typescript
interface ResponseData<T> {
  code: number; // 状态码，0 表示成功
  data: T; // 响应数据
  message: string; // 响应消息
}
```

### 分页响应格式

```typescript
interface PaginatedResponse<T> {
  items: T[]; // 数据列表
  total: number; // 总数
  page: number; // 当前页
  page_size: number; // 每页数量
}
```

## 错误处理

### 全局错误处理

所有 API 请求的错误都会被全局拦截器捕获并显示错误提示。

### 自定义错误处理

如果需要自定义错误处理，可以在调用时捕获异常：

```typescript
try {
  const { data } = await listCloudAccountsApi(params);
  // 处理成功响应
} catch (error) {
  // 自定义错误处理
  console.error("Custom error handling:", error);
}
```

## 请求拦截器

### 全局请求拦截

在 `request/index.ts` 中配置全局请求拦截器，可以：

- 添加认证 token
- 添加公共请求头
- 记录请求日志

### 单次请求拦截

某些 API 可能需要特殊的请求/响应处理，可以使用 `interceptorsToOnce` 参数：

```typescript
instance.get({
  url: "/api/endpoint",
  interceptorsToOnce: {
    requestInterceptor: (config) => {
      // 自定义请求处理
      return config;
    },
    responseInterceptor: (response) => {
      // 自定义响应处理
      return response;
    },
  },
});
```

## 环境配置

API 基础 URL 通过环境变量配置：

### 开发环境 (.env.development)

```
VITE_API_BASE_URL=/api
```

### 生产环境 (.env.production)

```
VITE_API_BASE_URL=https://api.example.com
```

## 代理配置

开发环境下，Vite 会将 `/api` 请求代理到后端服务器。

在 `vite.config.ts` 中配置：

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

## 类型安全

所有 API 接口都有完整的 TypeScript 类型定义，确保类型安全：

```typescript
// 请求参数类型检查
const params: ListAccountsParams = {
  page: 1,
  page_size: 10,
  provider: "aliyun", // 类型安全，只能是预定义的值
};

// 响应数据类型推断
const { data } = await listCloudAccountsApi(params);
// data 的类型会被自动推断为 ListAccountsResponse
```

## 最佳实践

1. **统一错误处理**：使用全局错误拦截器，避免在每个组件中重复处理
2. **类型定义**：为所有 API 请求和响应定义类型
3. **请求取消**：对于可能重复触发的请求，考虑使用 AbortController 取消
4. **加载状态**：在组件中维护 loading 状态，提供更好的用户体验
5. **错误重试**：对于网络错误，可以实现自动重试机制
6. **请求缓存**：对于不常变化的数据，可以使用缓存减少请求

## 注意事项

1. 所有 API 调用都是异步的，需要使用 async/await 或 Promise
2. 确保在组件卸载时取消未完成的请求，避免内存泄漏
3. 敏感数据（如密钥）不要在前端存储或日志中输出
4. 大文件上传/下载需要特殊处理，考虑使用分片上传
5. 注意 API 请求的频率限制，避免触发后端限流
