<template>
  <div class="ecs-table">
    <el-table
      :data="assets"
      v-loading="loading"
      stripe
      style="width: 100%"
      max-height="calc(100vh - 24rem)"
    >
      <el-table-column
        prop="asset_id"
        label="实例ID"
        width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="asset_name"
        label="实例名称"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="云厂商" width="140" align="center">
        <template #default="{ row }">
          <div class="provider-cell">
            <ProviderIcon :provider="row.provider" size="small" />
            <span>{{ getProviderLabel(row.provider) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="region" label="区域" width="120" align="center" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <EcsStatusBadge :status="row.status" />
        </template>
      </el-table-column>
      <el-table-column label="成本" width="100" align="right">
        <template #default="{ row }">
          {{ formatCost(row.cost) }}
        </template>
      </el-table-column>
      <el-table-column label="发现时间" width="160" align="center">
        <template #default="{ row }">
          {{ formatTime(row.discover_time, 'YYYY-MM-DD HH:mm') }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary" link @click="handleView(row)">
            查看
          </el-button>
          <el-button size="small" type="primary" link @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button size="small" type="danger" link @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import type { Asset } from '@/api/types/asset'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { getProviderLabel } from '@/utils/constants'
import { formatCost, formatTime } from '@/utils/formatters'
import EcsStatusBadge from './EcsStatusBadge.vue'

interface Props {
  assets: Asset[]
  loading: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

interface Emits {
  (e: 'view', asset: Asset): void
  (e: 'edit', asset: Asset): void
  (e: 'delete', asset: Asset): void
}

const emit = defineEmits<Emits>()

const handleView = (asset: Asset) => {
  emit('view', asset)
}

const handleEdit = (asset: Asset) => {
  emit('edit', asset)
}

const handleDelete = (asset: Asset) => {
  emit('delete', asset)
}
</script>

<style scoped lang="scss">
.ecs-table {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.provider-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
