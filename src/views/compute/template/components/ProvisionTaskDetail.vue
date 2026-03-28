<template>
  <el-drawer
    :model-value="visible"
    title="创建任务详情"
    size="700px"
    @close="$emit('update:visible', false)"
  >
    <template v-if="task">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="任务 ID">{{ task?.id || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建方式">
          <el-tag :type="task?.source === 'from_template' ? 'primary' : 'success'" size="small">
            {{ task?.source === 'from_template' ? '模板创建' : '直接创建' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(task?.status)" size="small">{{ statusLabel(task?.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="进度">{{ task?.progress || 0 }}%</el-descriptions-item>
        <el-descriptions-item label="创建数量">{{ task?.count || 0 }}</el-descriptions-item>
        <el-descriptions-item label="成功/失败">
          <span style="color: #67c23a">{{ task?.success_count || 0 }}</span> /
          <span style="color: #f56c6c">{{ task?.failed_count || 0 }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="同步状态">{{ task?.sync_status || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">
          {{ task?.created_at ? new Date(task.created_at).toLocaleString() : '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="消息" :span="2">{{ task?.message || '-' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 实例创建结果 -->
      <h4 style="margin: 16px 0 8px">实例创建结果</h4>
      <el-table :data="safeInstances" stripe size="small" style="width: 100%">
        <el-table-column prop="index" label="#" width="50" />
        <el-table-column prop="name" label="实例名称" min-width="140" />
        <el-table-column label="实例 ID" min-width="180">
          <template #default="{ row }">{{ row?.instance_id || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row?.status === 'success' ? 'success' : 'danger'" size="small">
              {{ row?.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="同步" width="80">
          <template #default="{ row }">
            <el-tag :type="syncTagType(row?.sync_status)" size="small">
              {{ row?.sync_status || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row?.error || '-' }}</template>
        </el-table-column>
      </el-table>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import type { ProvisionTask } from '@/api/types/template';
import { computed } from 'vue';

const props = defineProps<{
  visible: boolean
  task: ProvisionTask | null
}>()

defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

const safeInstances = computed(() =>
  (props.task?.instances || []).filter(item => item != null)
)

function statusTagType(status?: string): string {
  const map: Record<string, string> = {
    pending: 'info', running: 'warning', success: 'success',
    partial_success: 'warning', failed: 'danger'
  }
  return map[status || ''] || 'info'
}

function statusLabel(status?: string): string {
  const map: Record<string, string> = {
    pending: '待执行', running: '执行中', success: '成功',
    partial_success: '部分成功', failed: '失败'
  }
  return map[status || ''] || status || '-'
}

function syncTagType(status?: string): string {
  const map: Record<string, string> = {
    pending: 'info', syncing: 'warning', synced: 'success', failed: 'danger'
  }
  return map[status || ''] || 'info'
}
</script>
