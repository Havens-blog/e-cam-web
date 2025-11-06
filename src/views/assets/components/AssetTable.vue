<template>
  <div class="asset-table">
    <el-table
      :data="assets"
      v-loading="loading"
      stripe
      style="width: 100%"
      height="calc(100vh - 20rem)"
    >
      <el-table-column
        prop="asset_id"
        label="资产ID"
        width="180"
        show-overflow-tooltip
      />
      <el-table-column
        prop="asset_name"
        label="资产名称"
        min-width="150"
        show-overflow-tooltip
      />
      <el-table-column label="云厂商" width="100" align="center">
        <template #default="{ row }">
          <el-tag size="small">{{ getProviderLabel(row.provider) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="资产类型" width="120" align="center">
        <template #default="{ row }">
          {{ getAssetTypeLabel(row.asset_type) }}
        </template>
      </el-table-column>
      <el-table-column prop="region" label="区域" width="120" align="center" />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <AssetStatusBadge :status="row.status" />
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
import { getAssetTypeLabel, getProviderLabel } from '@/utils/constants'
import { formatCost, formatTime } from '@/utils/formatters'
import AssetStatusBadge from './AssetStatusBadge.vue'

interface Props {
  assets: Asset[]
  loading?: boolean
}

interface Emits {
  (e: 'view', asset: Asset): void
  (e: 'edit', asset: Asset): void
  (e: 'delete', asset: Asset): void
}

defineProps<Props>()
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
.asset-table {
  background: white;
  border-radius: calc(0.4rem + 0.1vw);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
  padding: calc(1rem + 0.2vw);
}
</style>
