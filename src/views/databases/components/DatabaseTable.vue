<template>
  <div class="database-table">
    <el-table
      :data="data"
      v-loading="loading"
      stripe
      style="width: 100%"
      max-height="calc(100vh - 26rem)"
      @row-click="handleRowClick"
    >
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <!-- 状态列 -->
          <template v-if="col.status">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
          <!-- 云厂商列 -->
          <template v-else-if="col.provider">
            <div class="provider-cell">
              <ProviderIcon :provider="row.provider" size="small" />
              <span>{{ getProviderLabel(row.provider) }}</span>
            </div>
          </template>
          <!-- 标签列 -->
          <template v-else-if="col.tag">
            <el-tag size="small">{{ getNestedValue(row, col.prop) || '-' }}</el-tag>
          </template>
          <!-- Redis 架构列 -->
          <template v-else-if="col.architecture">
            <el-tag size="small">{{ getArchitectureLabel(getNestedValue(row, col.prop)) }}</el-tag>
          </template>
          <!-- 容量列 -->
          <template v-else-if="col.capacity">
            {{ getNestedValue(row, col.prop) ? getNestedValue(row, col.prop) + ' MB' : '-' }}
          </template>
          <!-- 存储列 -->
          <template v-else-if="col.storage">
            {{ getNestedValue(row, col.prop) ? getNestedValue(row, col.prop) + ' GB' : '-' }}
          </template>
          <!-- MongoDB 类型列 -->
          <template v-else-if="col.mongoType">
            <el-tag size="small">{{ getMongoTypeLabel(getNestedValue(row, col.prop)) }}</el-tag>
          </template>
          <!-- 默认列 -->
          <template v-else>
            {{ getNestedValue(row, col.prop) || '-' }}
          </template>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click.stop="handleView(row)">
            查看
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!loading && data.length === 0" description="暂无数据" />
  </div>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'

interface Column {
  prop: string
  label: string
  width?: number
  minWidth?: number
  tag?: boolean
  status?: boolean
  provider?: boolean
  architecture?: boolean
  capacity?: boolean
  storage?: boolean
  mongoType?: boolean
}

interface Props {
  data: Asset[]
  loading: boolean
  columns: Column[]
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

interface Emits {
  (e: 'view', row: Asset): void
}

const emit = defineEmits<Emits>()

// 获取嵌套属性值
const getNestedValue = (obj: any, path: string) => {
  return path.split('.').reduce((acc, part) => acc?.[part], obj)
}

const handleRowClick = (row: Asset) => {
  emit('view', row)
}

const handleView = (row: Asset) => {
  emit('view', row)
}

// 云厂商标签
const getProviderLabel = (provider: string) => {
  const map: Record<string, string> = {
    aliyun: '阿里云',
    aws: 'AWS',
    huawei: '华为云',
    tencent: '腾讯云',
    volcano: '火山引擎',
  }
  return map[provider] || provider || '-'
}

// 状态类型映射
const getStatusType = (status: string): 'success' | 'info' | 'warning' | 'danger' => {
  const map: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
    running: 'success',
    Running: 'success',
    stopped: 'info',
    Stopped: 'info',
    creating: 'warning',
    Creating: 'warning',
    deleting: 'danger',
    Deleting: 'danger',
  }
  return map[status] || 'info'
}

// 状态标签映射
const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    running: '运行中',
    Running: '运行中',
    stopped: '已停止',
    Stopped: '已停止',
    creating: '创建中',
    Creating: '创建中',
    deleting: '删除中',
    Deleting: '删除中',
  }
  return map[status] || status || '-'
}

// Redis 架构标签
const getArchitectureLabel = (arch: string) => {
  const map: Record<string, string> = {
    standard: '标准版',
    cluster: '集群版',
    rwsplit: '读写分离版',
  }
  return map[arch] || arch || '-'
}

// MongoDB 类型标签
const getMongoTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    replicate: '副本集',
    sharding: '分片集群',
    serverless: 'Serverless',
  }
  return map[type] || type || '-'
}
</script>

<style scoped lang="scss">
.database-table {
  :deep(.el-table) {
    cursor: pointer;
    
    .el-table__row:hover {
      background-color: var(--bg-hover);
    }
  }
}

.provider-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
