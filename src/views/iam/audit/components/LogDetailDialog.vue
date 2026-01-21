<template>
  <el-dialog
    v-model="dialogVisible"
    title="日志详情"
    width="800px"
    :close-on-click-modal="false"
  >
    <div v-if="log" class="log-detail">
      <!-- 基本信息 -->
      <el-descriptions title="基本信息" :column="2" border>
        <el-descriptions-item label="操作时间">
          {{ log.operation_time }}
        </el-descriptions-item>
        <el-descriptions-item label="操作人">
          {{ log.operator }}
        </el-descriptions-item>
        <el-descriptions-item label="操作类型">
          <el-tag :type="getOperationTypeColor(log.operation_type)">
            {{ getOperationTypeLabel(log.operation_type) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="操作结果">
          <el-tag :type="log.result === 'success' ? 'success' : 'danger'">
            {{ log.result === 'success' ? '成功' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="目标类型">
          {{ getTargetTypeLabel(log.target_type) }}
        </el-descriptions-item>
        <el-descriptions-item label="目标对象">
          {{ log.target_name }}
        </el-descriptions-item>
        <el-descriptions-item label="目标 ID">
          {{ log.target_id }}
        </el-descriptions-item>
        <el-descriptions-item label="云平台">
          <el-tag v-if="log.provider">
            {{ getProviderLabel(log.provider) }}
          </el-tag>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="IP 地址">
          {{ log.ip_address }}
        </el-descriptions-item>
        <el-descriptions-item label="User Agent">
          {{ log.user_agent || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 操作详情 -->
      <el-descriptions title="操作详情" :column="1" border class="detail-section">
        <el-descriptions-item label="操作描述">
          {{ log.description || '-' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 数据变更 -->
      <div v-if="log.changes" class="detail-section">
        <h4>数据变更</h4>
        <el-table :data="formatChanges(log.changes)" border style="width: 100%">
          <el-table-column prop="field" label="字段" width="200" />
          <el-table-column prop="before" label="变更前" />
          <el-table-column prop="after" label="变更后" />
        </el-table>
      </div>

      <!-- 请求数据 -->
      <div v-if="log.request_data" class="detail-section">
        <h4>请求数据</h4>
        <el-input
          :model-value="formatJSON(log.request_data)"
          type="textarea"
          :rows="8"
          readonly
        />
      </div>

      <!-- 响应数据 -->
      <div v-if="log.response_data" class="detail-section">
        <h4>响应数据</h4>
        <el-input
          :model-value="formatJSON(log.response_data)"
          type="textarea"
          :rows="8"
          readonly
        />
      </div>

      <!-- 错误信息 -->
      <div v-if="log.error_message" class="detail-section">
        <h4>错误信息</h4>
        <el-alert
          :title="log.error_message"
          type="error"
          :closable="false"
          show-icon
        />
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { AuditLog } from '@/api/types/iam'
import { CLOUD_PROVIDERS, OPERATION_TYPES, TARGET_TYPES } from '@/utils/constants'
import { computed } from 'vue'

interface Props {
  visible: boolean
  log?: AuditLog
}

interface Emits {
  (e: 'update:visible', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 格式化 JSON
const formatJSON = (data: any): string => {
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

// 格式化变更数据
const formatChanges = (changes: Record<string, any>): Array<{ field: string; before: string; after: string }> => {
  return Object.entries(changes).map(([field, change]) => ({
    field,
    before: formatValue(change.before),
    after: formatValue(change.after)
  }))
}

// 格式化值
const formatValue = (value: any): string => {
  if (value === null || value === undefined) {
    return '-'
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

// 获取操作类型标签
const getOperationTypeLabel = (type: string): string => {
  const item = OPERATION_TYPES.find(t => t.value === type)
  return item?.label || type
}

// 获取操作类型颜色
const getOperationTypeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    create: 'success',
    update: 'warning',
    delete: 'danger',
    query: 'info',
    sync: 'primary'
  }
  return colorMap[type] || 'info'
}

// 获取目标类型标签
const getTargetTypeLabel = (type: string): string => {
  const item = TARGET_TYPES.find(t => t.value === type)
  return item?.label || type
}

// 获取云平台标签
const getProviderLabel = (provider: string): string => {
  const item = CLOUD_PROVIDERS.find(p => p.value === provider)
  return item?.label || provider
}
</script>

<style scoped lang="scss">
.log-detail {
  .detail-section {
    margin-top: 20px;

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
}
</style>
