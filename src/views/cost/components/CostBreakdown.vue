<template>
  <div class="cost-breakdown">
    <el-tabs v-model="activeTab" type="card">
      <!-- 按资产分解 -->
      <el-tab-pane label="按资产" name="asset">
        <el-table
          :data="assetCosts"
          stripe
          style="width: 100%"
          max-height="400px"
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
          <el-table-column
            prop="asset_type"
            label="资产类型"
            width="120"
            align="center"
          />
          <el-table-column label="成本" width="120" align="right">
            <template #default="{ row }">
              <span class="cost-value">{{ formatCost(row.cost) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="占比" width="100" align="right">
            <template #default="{ row }">
              {{ formatPercentage(row.cost, totalAssetCost) }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 按区域分解 -->
      <el-tab-pane label="按区域" name="region">
        <el-table
          :data="regionCostList"
          stripe
          style="width: 100%"
          max-height="400px"
        >
          <el-table-column prop="region" label="区域" min-width="150" />
          <el-table-column label="成本" width="120" align="right">
            <template #default="{ row }">
              <span class="cost-value">{{ formatCost(row.cost) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="占比" width="100" align="right">
            <template #default="{ row }">
              {{ formatPercentage(row.cost, totalRegionCost) }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import type { AssetCost } from '@/api/types/cost'
import { formatCost, formatPercentage } from '@/utils/formatters'
import { computed, ref } from 'vue'

interface Props {
  assetCosts: AssetCost[]
  regionCosts: Record<string, number>
}

const props = defineProps<Props>()

const activeTab = ref('asset')

// 区域成本列表
const regionCostList = computed(() => {
  return Object.entries(props.regionCosts).map(([region, cost]) => ({
    region,
    cost,
  }))
})

// 总成本计算
const totalAssetCost = computed(() => {
  return props.assetCosts.reduce((sum, item) => sum + item.cost, 0)
})

const totalRegionCost = computed(() => {
  return Object.values(props.regionCosts).reduce((sum, cost) => sum + cost, 0)
})
</script>

<style scoped lang="scss">
.cost-breakdown {
  background: white;
  border-radius: calc(0.4rem + 0.1vw);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);
  padding: calc(1rem + 0.2vw);

  .cost-value {
    color: #10b981;
    font-weight: 600;
  }
}
</style>
