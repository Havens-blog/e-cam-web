<template>
  <div class="asset-table">
    <el-table
      :data="assets"
      v-loading="loading"
      stripe
      style="width: 100%"
      max-height="calc(100vh - 24rem)"
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
      <el-table-column label="云厂商" width="140" align="center">
        <template #default="{ row }">
          <div class="provider-cell">
            <ProviderIcon :provider="row.provider" size="small" />
            <span>{{ getProviderLabel(row.provider) }}</span>
          </div>
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
          <AssetStatusBadge :status="row.status" :labels="statusLabels" />
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
import AssetStatusBadge from '@/components/AssetStatusBadge.vue'
import { getAssetTypeLabel, getProviderLabel } from '@/utils/constants'
import { formatCost, formatTime } from '@/utils/formatters'

/**
 * 全局资产表状态 → 展示文案。
 * 全局资产列表聚合各资产域（ecs/rds/redis/mongodb/vpc/eip…），状态词表比任一单模块
 * 都宽，这里收录各列表页 statusLabels / ASSET_STATUS(src/utils/constants.ts) 的并集；
 * 同键跨模块语义不同时取更通用的措辞（available→可用、pending→创建中、stopped→已停止、
 * active→运行中），冲突明细见 field-consistency.md §2 域3。
 * 待运行时复核: 真实取值域以运行时抓样为准；restarting/upgrading 来自
 * src/api/types/asset.ts 的 AssetStatus，尚无既有文案。未命中的状态由徽章回退显示原始值。
 */
const statusLabels: Record<string, string> = {
  // 运行态
  running: '运行中', Running: '运行中', RUNNING: '运行中',
  active: '运行中', Active: '运行中',
  serving: '运行中', normal: '运行中', accomplished: '正常',
  online: '正常', Online: '正常', Deployed: '正常', deployed: '正常',
  Started: '正常', started: '正常',
  in_use: '使用中', InUse: '使用中', inuse: '使用中', BINDBOUND: '使用中', ACTIVE: '使用中',
  available: '可用', Available: '可用', DOWN: '可用', BINDUNBOUND: '可用',
  Bindable: '可绑定',
  // 停止 / 停用
  stopped: '已停止', Stopped: '已停止', STOPPED: '已关机',
  inactive: '已停止', Inactive: '已停止',
  offline: '已停用', Offline: '已停用', disabled: '已停用',
  closed: '已停止', Closed: '已停止', shutdown: '已停止',
  terminated: '已销毁', deleted: '已删除', DELETED: '已删除',
  // 过渡态
  pending: '创建中', Pending: '创建中', PENDING: '创建中',
  creating: '创建中', Creating: '创建中', progressing: '创建中',
  starting: '启动中', stopping: '停止中',
  rebooting: '重启中', restarting: '重启中', upgrading: '升级中',
  configuring: '配置中', Configuring: '配置中',
  checking: '审核中', Checking: '审核中',
  attaching: '绑定中', Attaching: '绑定中',
  detaching: '解绑中', Detaching: '解绑中',
  deleting: '删除中', Deleting: '删除中',
  InProgress: '部署中', inprogress: '部署中', deploying: '部署中', Deploying: '部署中',
  Waiting: '等待中', waiting: '等待中',
  // 异常 / 其他
  error: '异常', Error: '异常',
  failed: '失败', Failed: '失败',
  check_failed: '审核失败', CheckFailed: '审核失败',
  locked: '已锁定', Locked: '已锁定',
  expired: '已过期', expiring: '即将到期',
  UnAvailable: '不可用', unavailable: '不可用',
  unknown: '未知',
}

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
.asset-table {
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
