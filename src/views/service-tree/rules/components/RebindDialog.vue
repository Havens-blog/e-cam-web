<template>
  <el-dialog
    :model-value="modelValue"
    :title="`规则改绑预览（${candidates.length} 条候选）`"
    width="760px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="rebind-tip"
      title="以下资产当前按旧规则绑定，现可按更高优先级规则改绑到新节点。手动绑定的资产不会被修改。"
    />

    <el-table v-loading="loading" :data="candidates" max-height="420" stripe>
      <el-table-column prop="asset_name" label="资产名称" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="asset-name">{{ row.asset_name || row.asset_id }}</div>
          <div class="asset-sub">{{ row.asset_id }}</div>
        </template>
      </el-table-column>
      <el-table-column prop="provider" label="云平台" width="90" align="center" />
      <el-table-column label="改绑方向" min-width="220">
        <template #default="{ row }">
          <div class="move-line">
            <span class="move-from">{{ row.from_node_name || `节点#${row.from_node_id}` }}</span>
            <el-icon class="move-arrow"><Right /></el-icon>
            <span class="move-to">{{ row.to_node_name || `节点#${row.to_node_id}` }}</span>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button
        type="primary"
        :loading="applying"
        :disabled="candidates.length === 0"
        @click="handleApply"
      >
        确认改绑全部（{{ candidates.length }} 条）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { applyRebindApi, previewRebindApi } from '@/api/service-tree'
import type { RebindCandidate } from '@/api/types/service-tree'
import { Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success', count: number): void
}>()

const candidates = ref<RebindCandidate[]>([])
const loading = ref(false)
const applying = ref(false)

// 打开时加载改绑候选
watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) return
    loading.value = true
    candidates.value = []
    try {
      const res = await previewRebindApi()
      candidates.value = res.data?.items || []
    } catch (error: any) {
      ElMessage.error(error.message || '改绑预览失败')
    } finally {
      loading.value = false
    }
  }
)

// 确认改绑全部候选
const handleApply = async () => {
  if (candidates.value.length === 0) return
  applying.value = true
  try {
    const res = await applyRebindApi({
      resource_ids: candidates.value.map(c => c.resource_id)
    })
    ElMessage.success(`已改绑 ${res.data ?? 0} 条资产`)
    emit('update:modelValue', false)
    emit('success', res.data ?? 0)
  } catch (error: any) {
    ElMessage.error(error.message || '改绑失败')
  } finally {
    applying.value = false
  }
}
</script>

<style scoped lang="scss">
.rebind-tip {
  margin-bottom: 16px;
}

.asset-name {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}

.asset-sub {
  font-size: 12px;
  color: var(--text-tertiary);
}

.move-line {
  display: flex;
  align-items: center;
  gap: 8px;

  .move-from {
    color: var(--text-secondary);
  }

  .move-arrow {
    color: var(--text-tertiary);
    flex-shrink: 0;
  }

  .move-to {
    color: var(--text-primary);
    font-weight: 600;
  }
}
</style>