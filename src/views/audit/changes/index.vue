<template>
  <div class="vm-page">
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">资产变更历史</h1>
        <div class="stats-badges">
          <div class="stat-badge" v-if="summary">
            <span class="stat-label">总变更</span>
            <span class="stat-num">{{ summary.total }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 变更统计卡片 -->
    <div class="summary-cards" v-if="summary && !assetId">
      <div class="summary-card">
        <h4>按资源类型</h4>
        <div v-for="(count, type) in summary.by_resource_type" :key="type" class="summary-item">
          <span class="summary-label">{{ modelLabel(type as string) }}</span>
          <el-progress :percentage="Math.round(count / summary.total * 100)" :stroke-width="6" :show-text="false" />
          <span class="summary-count">{{ count }}</span>
        </div>
      </div>
      <div class="summary-card">
        <h4>按变更字段</h4>
        <div v-for="(count, field) in topFields" :key="field" class="summary-item">
          <span class="summary-label">{{ field }}</span>
          <el-progress :percentage="Math.round(count / summary.total * 100)" :stroke-width="6" :show-text="false" color="#f59e0b" />
          <span class="summary-count">{{ count }}</span>
        </div>
      </div>
      <div class="summary-card">
        <h4>按云厂商</h4>
        <div v-for="(count, provider) in summary.by_provider" :key="provider" class="summary-item">
          <span class="summary-label">{{ providerLabel(provider as string) }}</span>
          <el-progress :percentage="Math.round(count / summary.total * 100)" :stroke-width="6" :show-text="false" color="#10b981" />
          <span class="summary-count">{{ count }}</span>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <div class="action-left">
        <el-input v-model="assetId" placeholder="输入资产ID查询变更" clearable size="small" style="width: 220px" @clear="handleClearAsset" @keyup.enter="fetchChanges" />
        <el-select v-model="summaryFilter.model_uid" placeholder="资源类型" clearable size="small" style="width: 140px" @change="fetchSummary">
          <el-option label="虚拟机" value="cloud_vm" />
          <el-option label="RDS" value="cloud_rds" />
          <el-option label="Redis" value="cloud_redis" />
          <el-option label="VPC" value="cloud_vpc" />
          <el-option label="EIP" value="cloud_eip" />
        </el-select>
        <el-select v-model="summaryFilter.provider" placeholder="云厂商" clearable size="small" style="width: 120px" @change="fetchSummary">
          <el-option label="阿里云" value="aliyun" />
          <el-option label="AWS" value="aws" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="华为云" value="huawei" />
          <el-option label="火山引擎" value="volcano" />
        </el-select>
      </div>
      <div class="action-right">
        <el-button size="small" circle @click="handleRefresh" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 变更记录表格 -->
    <div class="table-wrapper" v-if="assetId">
      <el-table :data="changeList" v-loading="changesLoading" stripe style="width: 100%" row-key="id">
        <el-table-column prop="ctime" label="变更时间" width="170">
          <template #default="{ row }">{{ formatTs(row.ctime) }}</template>
        </el-table-column>
        <el-table-column prop="asset_name" label="资产名称" width="160" show-overflow-tooltip />
        <el-table-column prop="model_uid" label="资源类型" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ modelLabel(row.model_uid) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="field_name" label="变更字段" width="120" />
        <el-table-column prop="old_value" label="旧值" min-width="160">
          <template #default="{ row }">
            <span class="change-value old">{{ parseValue(row.old_value) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="" width="40" align="center">
          <template #default>
            <el-icon style="color: var(--el-color-primary)"><Right /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="new_value" label="新值" min-width="160">
          <template #default="{ row }">
            <span class="change-value new">{{ parseValue(row.new_value) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="change_source" label="变更来源" width="110">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ sourceLabel(row.change_source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="provider" label="云厂商" width="90">
          <template #default="{ row }">{{ providerLabel(row.provider) }}</template>
        </el-table-column>
        <el-table-column prop="region" label="地域" width="120" show-overflow-tooltip />
      </el-table>
    </div>

    <!-- 无资产ID时的提示 -->
    <div class="empty-hint" v-if="!assetId && !summary">
      <el-icon :size="48" color="var(--text-muted, #c0c4cc)"><Document /></el-icon>
      <p>输入资产ID查看详细变更记录，或查看下方统计汇总</p>
    </div>

    <div class="pagination-bar" v-if="assetId">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="changesTotal"
        layout="total, prev, pager, next"
        small
        @current-change="fetchChanges"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AssetChange, ChangeSummary } from '@/api/audit'
import { getChangeSummaryApi, listAssetChangesApi } from '@/api/audit'
import { Document, Refresh, Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

const assetId = ref('')
const changeList = ref<AssetChange[]>([])
const changesLoading = ref(false)
const changesTotal = ref(0)
const page = ref(1)
const pageSize = 20

const summary = ref<ChangeSummary | null>(null)
const summaryFilter = reactive({ model_uid: '', provider: '' })

const modelLabel = (uid: string) => {
  const m: Record<string, string> = {
    cloud_vm: '虚拟机', cloud_rds: 'RDS', cloud_redis: 'Redis',
    cloud_vpc: 'VPC', cloud_eip: 'EIP', cloud_disk: '云盘',
    cloud_oss: 'OSS', cloud_nas: 'NAS', cloud_kafka: 'Kafka',
    cloud_elasticsearch: 'ES', cloud_mongodb: 'MongoDB',
  }
  return m[uid] || uid
}

const providerLabel = (p: string) => {
  const m: Record<string, string> = {
    aliyun: '阿里云', aws: 'AWS', tencent: '腾讯云',
    huawei: '华为云', volcano: '火山引擎',
  }
  return m[p] || p
}

const sourceLabel = (s: string) => {
  const m: Record<string, string> = { sync_task: '同步任务', manual: '手动修改', api: 'API调用' }
  return m[s] || s
}

const formatTs = (ts: number) => ts ? new Date(ts).toLocaleString('zh-CN') : '-'

const parseValue = (val: string) => {
  if (!val || val === '""') return '-'
  try {
    const parsed = JSON.parse(val)
    return typeof parsed === 'object' ? JSON.stringify(parsed) : String(parsed)
  } catch {
    return val
  }
}

// 取 top 8 字段
const topFields = computed(() => {
  if (!summary.value?.by_field) return {}
  const entries = Object.entries(summary.value.by_field)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
  return Object.fromEntries(entries)
})

const fetchSummary = async () => {
  try {
    const params: any = {}
    if (summaryFilter.model_uid) params.model_uid = summaryFilter.model_uid
    if (summaryFilter.provider) params.provider = summaryFilter.provider
    const res = await getChangeSummaryApi(params)
    summary.value = (res as any).data?.data || (res as any).data || null
  } catch (e: any) {
    console.error('获取变更汇总失败:', e)
  }
}

const fetchChanges = async () => {
  if (!assetId.value.trim()) return
  changesLoading.value = true
  try {
    const res = await listAssetChangesApi(assetId.value.trim(), {
      offset: (page.value - 1) * pageSize,
      limit: pageSize,
    })
    const data = (res as any).data
    changeList.value = data?.items || data?.data?.items || []
    changesTotal.value = data?.total || data?.data?.total || 0
  } catch (e: any) {
    ElMessage.error(e.message || '查询变更历史失败')
  } finally {
    changesLoading.value = false
  }
}

const handleClearAsset = () => {
  changeList.value = []
  changesTotal.value = 0
}

const handleRefresh = () => {
  if (assetId.value) fetchChanges()
  else fetchSummary()
}

onMounted(() => fetchSummary())
</script>

<style lang="scss" scoped>
.vm-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-top {
  background: var(--glass-bg, #fff);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 12px;
  padding: 16px 20px;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #303133);
  margin: 0;
}
.stats-badges {
  display: flex;
  gap: 12px;
}
.stat-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 20px;
  font-size: 13px;
}
.stat-label { color: var(--text-secondary, #909399); }
.stat-num { font-weight: 600; color: var(--text-primary, #303133); }
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.summary-card {
  background: var(--glass-bg, #fff);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 10px;
  padding: 16px;
  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #303133);
  }
}
.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  .summary-label {
    width: 80px;
    flex-shrink: 0;
    font-size: 12px;
    color: var(--text-secondary, #909399);
    text-align: right;
  }
  .el-progress { flex: 1; }
  .summary-count {
    width: 36px;
    text-align: right;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #303133);
  }
}
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--glass-bg, #fff);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 8px;
}
.action-left, .action-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-wrapper {
  flex: 1;
  background: var(--glass-bg, #fff);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}
.change-value {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  &.old {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
  &.new {
    background: rgba(16, 185, 129, 0.1);
    color: #10b981;
  }
}
.empty-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  p {
    color: var(--text-tertiary, #c0c4cc);
    font-size: 14px;
    margin: 0;
  }
}
</style>
