<template>
  <PageContainer>
    <ManagerHeader
      title="WAF 防火墙"
      subtitle="管理所有云平台的 Web 应用防火墙实例"
      @refresh="fetchData"
    >
      <template #actions>
        <el-button @click="exportDialogVisible = true">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button type="primary" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </template>
    </ManagerHeader>

    <!-- 统计卡片 -->
    <WafStatsCards :total="pagination.total" :active-count="activeCount" />

    <!-- 标签页 -->
    <div class="waf-tabs">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="waf-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
      </div>
    </div>

    <!-- 实例列表 Tab -->
    <template v-if="activeTab === 'instances'">
      <!-- 筛选器 -->
      <div class="waf-filters">
        <div class="filters-left">
          <el-input
            v-model="filters.name"
            placeholder="搜索实例名称、ID..."
            clearable
            @input="handleSearchInput"
            style="width: 280px"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filters.provider" placeholder="全部云平台" clearable @change="handleSearch" style="width: 130px">
            <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
          <el-select v-model="filters.edition" placeholder="全部版本" clearable @change="handleSearch" style="width: 120px">
            <el-option label="基础版" value="basic" />
            <el-option label="专业版" value="pro" />
            <el-option label="企业版" value="enterprise" />
          </el-select>
          <el-select v-model="filters.status" placeholder="全部状态" clearable @change="handleSearch" style="width: 120px">
            <el-option label="运行中" value="active" />
            <el-option label="即将到期" value="expiring" />
            <el-option label="已停用" value="inactive" />
          </el-select>
        </div>
        <div class="filters-right">
          <el-tooltip content="刷新">
            <el-button :icon="Refresh" circle size="small" @click="fetchData" />
          </el-tooltip>
          <el-tooltip content="重置筛选">
            <el-button :icon="RefreshLeft" circle size="small" @click="handleReset" />
          </el-tooltip>
        </div>
      </div>

      <!-- WAF 表格 -->
      <div class="waf-table-wrapper">
        <el-table
          v-loading="loading"
          :data="wafList"
          style="width: 100%"
          max-height="calc(100vh - 30rem)"
          @row-click="handleRowClick"
          @selection-change="handleSelectionChange"
          highlight-current-row
        >
          <el-table-column type="selection" width="40" />
          <el-table-column label="实例名称" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <div class="instance-cell">
                <span class="instance-name">{{ row.asset_name || row.asset_id || '-' }}</span>
                <span class="instance-id">{{ row.asset_id || '' }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <WafStatusBadge :status="row.status" />
            </template>
          </el-table-column>
          <el-table-column label="版本" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="getEditionTagType(row.attributes?.edition)" effect="plain">
                {{ getEditionLabel(row.attributes?.edition) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="云平台" width="140">
            <template #default="{ row }">
              <div class="provider-cell">
                <ProviderIcon :provider="row.provider" size="small" />
                <span>{{ row.attributes?.cloud_account_name || getProviderLabel(row.provider) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="防护域名" width="90" align="center">
            <template #default="{ row }">
              <span class="domain-count">{{ row.attributes?.domain_count || 0 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="防护模式" width="90" align="center">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="getProtectionModeType(row.attributes?.protection_mode)"
                effect="plain"
              >
                {{ getProtectionModeLabel(row.attributes?.protection_mode) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="QPS" width="80" align="center">
            <template #default="{ row }">
              {{ row.attributes?.qps || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="规则数" width="80" align="center">
            <template #default="{ row }">
              {{ row.attributes?.rule_count || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="区域" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.region || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="到期时间" width="130">
            <template #default="{ row }">
              <span class="mono-text" :class="{ 'expiring-text': isExpiringSoon(row.attributes?.expired_time) }">
                {{ row.attributes?.expired_time || '-' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right" align="center">
            <template #default="{ row }">
              <el-button type="primary" link @click.stop="handleRowClick(row)">查看详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loading && wafList.length === 0" description="暂无数据" />
      </div>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-bar">
        <span class="pagination-info">
          共 {{ pagination.total }} 条 · 第 {{ pagination.page }}/{{ Math.ceil(pagination.total / pagination.size) }} 页
          <template v-if="selectedIds.length > 0"> · 已选 {{ selectedIds.length }} 条</template>
        </span>
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[20, 50, 100]"
          layout="sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </template>

    <!-- 防护域名 Tab -->
    <template v-else-if="activeTab === 'domains'">
      <div class="empty-tab-content">
        <el-empty description="防护域名管理功能开发中..." />
      </div>
    </template>

    <!-- 安全报表 Tab -->
    <template v-else-if="activeTab === 'reports'">
      <div class="empty-tab-content">
        <el-empty description="安全报表功能开发中..." />
      </div>
    </template>

    <!-- 攻击日志 Tab -->
    <template v-else-if="activeTab === 'logs'">
      <div class="empty-tab-content">
        <el-empty description="攻击日志功能开发中..." />
      </div>
    </template>

    <!-- 同步对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步WAF实例" width="600px">
      <el-form :model="syncForm" label-width="100px">
        <el-form-item label="云厂商" required>
          <el-select v-model="syncForm.provider" placeholder="请选择云厂商" style="width: 100%">
            <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="syncDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="syncing" @click="submitSync">开始同步</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <WafDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
    <!-- 导出对话框 -->
    <WafExportDialog v-model:visible="exportDialogVisible" :instances="wafList" :selected-ids="selectedIds" :total="pagination.total" />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listWAFAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { Download, Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import WafDetailDrawer from './components/WafDetailDrawer.vue'
import WafExportDialog from './components/WafExportDialog.vue'
import WafStatsCards from './components/WafStatsCards.vue'
import WafStatusBadge from './components/WafStatusBadge.vue'

const router = useRouter()
const loading = ref(false)
const activeTab = ref('instances')
const filters = reactive({ provider: '', name: '', edition: '', status: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const wafList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)
let searchTimer: number | null = null

const exportDialogVisible = ref(false)
const selectedIds = ref<number[]>([])

const tabs = computed(() => [
  { key: 'instances', label: '实例列表', count: pagination.total },
  { key: 'domains', label: '防护域名', count: undefined },
  { key: 'reports', label: '安全报表', count: undefined },
  { key: 'logs', label: '攻击日志', count: undefined },
])

const activeCount = computed(() => wafList.value.filter(i =>
  ['active', 'Active', 'running'].includes(i.status)
).length)

const getEditionLabel = (edition: string | undefined) => {
  const map: Record<string, string> = { basic: '基础版', pro: '专业版', business: '商业版', enterprise: '企业版' }
  return map[edition || ''] || edition || '-'
}

const getEditionTagType = (edition: string | undefined): any => {
  const map: Record<string, string> = { basic: 'info', pro: 'primary', business: 'warning', enterprise: 'danger' }
  return map[edition || ''] || 'info'
}

const getProtectionModeLabel = (mode: string | undefined) => {
  const map: Record<string, string> = { block: '拦截', observe: '观察', off: '关闭' }
  return map[mode || ''] || mode || '拦截'
}

const getProtectionModeType = (mode: string | undefined): any => {
  const map: Record<string, string> = { block: 'danger', observe: 'warning', off: 'info' }
  return map[mode || ''] || 'danger'
}

const isExpiringSoon = (expiredTime: string | undefined) => {
  if (!expiredTime) return false
  try {
    const expDate = new Date(expiredTime)
    const now = new Date()
    const diffDays = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays > 0 && diffDays <= 90
  } catch {
    return false
  }
}

const handleSelectionChange = (rows: Asset[]) => { selectedIds.value = rows.map(r => r.id) }

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { offset: (pagination.page - 1) * pagination.size, limit: pagination.size }
    if (filters.provider) params.provider = filters.provider
    if (filters.name) params.name = filters.name
    if (filters.edition) params.edition = filters.edition
    if (filters.status) params.status = filters.status
    const res = await listWAFAssetsApi(params)
    const responseData = (res as any).data || res
    wafList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取WAF列表失败'
    ElMessage.error(msg)
    wafList.value = []
    pagination.total = 0
  } finally { loading.value = false }
}

const handleSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => { pagination.page = 1; fetchData() }, 500)
}
const handleSearch = () => { pagination.page = 1; fetchData() }
const handleSizeChange = () => { pagination.page = 1; fetchData() }
const handlePageChange = () => { fetchData() }
const handleReset = () => { Object.assign(filters, { provider: '', name: '', edition: '', status: '' }); handleSearch() }
const handleRowClick = (row: Asset) => { detailInstance.value = row; detailVisible.value = true }
const handleSync = () => { syncForm.provider = ''; syncDialogVisible.value = true }
const submitSync = async () => {
  if (!syncForm.provider) { ElMessage.warning('请选择云厂商'); return }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['waf'] })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '提交同步任务失败'
    ElMessage.error(msg)
  } finally { syncing.value = false }
}

onMounted(() => { fetchData() })
</script>

<style scoped lang="scss">
.waf-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--glass-border);

  .waf-tab {
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-tertiary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
    user-select: none;

    &:hover {
      color: var(--text-primary);
    }

    &.active {
      color: var(--el-color-primary);
      border-bottom-color: var(--el-color-primary);
    }

    .tab-count {
      margin-left: 6px;
      font-size: 10px;
      background: rgba(64, 158, 255, 0.12);
      color: var(--el-color-primary);
      padding: 1px 6px;
      border-radius: 8px;
      font-weight: 600;
    }
  }
}

.waf-filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;

  .filters-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .filters-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    margin-left: 12px;
  }
}

.waf-table-wrapper {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  overflow: hidden;

  :deep(.el-table) {
    cursor: pointer;
  }

  .instance-cell {
    display: flex;
    flex-direction: column;
    line-height: 1.4;

    .instance-name {
      color: var(--el-color-primary);
      font-weight: 500;
      font-size: 13px;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }

    .instance-id {
      color: var(--text-tertiary);
      font-size: 11px;
      margin-top: 2px;
      font-family: 'SF Mono', Consolas, monospace;
    }
  }

  .domain-count {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .provider-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--text-secondary);
  }

  .mono-text {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .expiring-text {
    color: var(--el-color-warning);
  }
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  margin-top: 12px;

  .pagination-info {
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.empty-tab-content {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 60px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
