<template>
  <el-dialog
    :model-value="visible"
    :title="isBatch ? '批量删除确认' : '删除确认'"
    width="480px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="delete-content">
      <el-icon class="warning-icon" :size="48"><WarningFilled /></el-icon>
      <template v-if="isBatch">
        <p class="delete-msg">确定要删除选中的 <strong>{{ records.length }}</strong> 条解析记录吗？</p>
        <p class="delete-hint">此操作不可撤销，删除后将立即生效。</p>
      </template>
      <template v-else-if="records.length === 1">
        <p class="delete-msg">确定要删除以下解析记录吗？</p>
        <div class="record-info">
          <div class="info-row">
            <span class="info-label">主机记录：</span>
            <span>{{ records[0]?.rr || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">记录类型：</span>
            <span class="record-type" :class="records[0]?.type">{{ records[0]?.type || '-' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">记录值：</span>
            <span class="mono">{{ records[0]?.value || '-' }}</span>
          </div>
        </div>
        <p class="delete-hint">此操作不可撤销，删除后将立即生效。</p>
      </template>
    </div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="danger" :loading="deleting" @click="handleConfirm">确认删除</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { DnsRecord } from '@/api/types/dns'
import { WarningFilled } from '@element-plus/icons-vue'
import { computed, ref } from 'vue'

interface Props {
  visible: boolean
  records: DnsRecord[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [val: boolean]
  'confirm': []
}>()

const deleting = ref(false)
const isBatch = computed(() => props.records.length > 1)

const handleConfirm = () => {
  emit('confirm')
}

defineExpose({ setLoading: (val: boolean) => { deleting.value = val } })
</script>

<style scoped lang="scss">
.delete-content {
  text-align: center;
  padding: 8px 0;
}

.warning-icon {
  color: var(--el-color-danger);
  margin-bottom: 16px;
}

.delete-msg {
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--text-primary);

  strong {
    color: var(--el-color-danger);
  }
}

.delete-hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 12px;
}

.record-info {
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  padding: 12px 16px;
  text-align: left;
  display: inline-block;
  min-width: 280px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

.info-label {
  color: var(--text-secondary);
  min-width: 70px;
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.record-type {
  display: inline-flex;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;

  &.A { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
  &.AAAA { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
  &.CNAME { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
  &.MX { background: rgba(236, 72, 153, 0.15); color: #f472b6; }
  &.TXT { background: rgba(16, 185, 129, 0.15); color: #34d399; }
  &.NS { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
  &.SRV { background: rgba(239, 68, 68, 0.15); color: #f87171; }
  &.CAA { background: rgba(107, 114, 128, 0.15); color: #9ca3af; }
}
</style>
