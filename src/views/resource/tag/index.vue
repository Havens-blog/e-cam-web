<template>
  <div class="tag-management-page">
    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-left">
        <h1>🏷️ 标签管理</h1>
        <p>多云标签统一管理，支持标签查询、绑定、解绑、批量操作和标签策略治理</p>
      </div>
      <div class="page-header-right">
        <el-button type="primary" @click="showBindDialog = true">
          ＋ 添加标签
        </el-button>
        <el-button @click="showBatchDialog = true">
          📦 批量操作
        </el-button>
        <el-button circle @click="handleRefresh" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Stats Cards -->
    <TagStatsCards :stats="tagStats" />

    <!-- Tab Bar -->
    <div class="tab-bar">
      <div
        class="tab-item"
        :class="{ active: activeTab === 'tagList' }"
        @click="activeTab = 'tagList'"
      >
        标签列表 <span class="tab-badge">{{ tagTotal }}</span>
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'policies' }"
        @click="activeTab = 'policies'"
      >
        标签策略 <span class="tab-badge">{{ policyCount }}</span>
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'compliance' }"
        @click="activeTab = 'compliance'"
      >
        合规检查 <span class="tab-badge">{{ complianceCount }}</span>
      </div>
      <div
        class="tab-item"
        :class="{ active: activeTab === 'autoTag' }"
        @click="activeTab = 'autoTag'"
      >
        自动打标 <span class="tab-badge">{{ ruleCount }}</span>
      </div>
    </div>

    <!-- Tag List Tab -->
    <div v-show="activeTab === 'tagList'">
      <TagFilters v-model="filters" @search="handleSearch" @export="handleExport" />

      <!-- Batch Action Bar -->
      <div v-if="selectedTags.length > 0" class="batch-bar">
        <div class="batch-left">
          ✅ 已选 <strong>{{ selectedTags.length }}</strong> 个标签维度
        </div>
        <div class="batch-right">
          <el-button size="small" type="primary" @click="openResourceDrawerForBatch">🏷 查看关联资源</el-button>
          <el-button size="small" @click="clearSelection">取消选择</el-button>
        </div>
      </div>

      <!-- Tag Table -->
      <div class="table-wrap">
        <el-table
          ref="tableRef"
          :data="tagList.filter(item => item != null)"
          v-loading="tableLoading"
          style="width: 100%"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="40" />
          <el-table-column prop="key" label="标签键" min-width="120">
            <template #default="{ row }">
              <span style="font-weight: 600; color: #409eff">{{ row?.key }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="value" label="标签值" min-width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="getValueTagType(row?.value)">{{ row?.value }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="resource_count" label="关联资源数" width="120">
            <template #default="{ row }">
              <a class="cell-link" @click="openResourceDrawer(row)">{{ row?.resource_count }}</a>
            </template>
          </el-table-column>
          <el-table-column prop="providers" label="云厂商" width="200">
            <template #default="{ row }">
              <el-tag
                v-for="p in (row?.providers || []).filter((i: string) => i != null)"
                :key="p"
                size="small"
                :type="getProviderTagType(p)"
                style="margin-right: 4px"
              >{{ getProviderLabel(p) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openResourceDrawer(row)">关联资源</el-button>
              <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleUnbind(row)">解绑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Pagination -->
      <div class="pagination-bar">
        <div class="pagination-info">
          本页 {{ tagList.length }} 条 / 共 {{ tagTotal }} 条
        </div>
        <div style="display: flex; align-items: center; gap: 12px">
          <el-select v-model="pageSize" style="width: 110px" @change="handlePageSizeChange">
            <el-option :value="20" label="20 条/页" />
            <el-option :value="50" label="50 条/页" />
            <el-option :value="100" label="100 条/页" />
          </el-select>
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="tagTotal"
            layout="prev, pager, next"
            @current-change="loadTags"
          />
        </div>
      </div>
    </div>

    <!-- Policy / Compliance Tabs -->
    <TagPolicyPanel
      v-if="activeTab === 'policies' || activeTab === 'compliance'"
      ref="policyPanelRef"
      :active-view="activeTab === 'policies' ? 'policies' : 'compliance'"
      @remediate="handleRemediate"
    />

    <!-- Auto Tag Rules Tab -->
    <TagRulePanel v-if="activeTab === 'autoTag'" ref="rulePanelRef" />

    <!-- Dialogs & Drawers -->
    <TagBindDialog v-model="showBindDialog" @success="handleRefresh" />
    <TagBatchDialog
      v-model="showBatchDialog"
      :selected-resources="selectedTags"
      :mode="batchMode"
      :compliance-resources="remediateResources"
      :bind-resource-refs="bindResourceRefs"
      :policy-name="remediatePolicyName"
      :required-keys="remediateRequiredKeys"
      @success="handleRefresh"
    />
    <TagResourceDrawer
      v-model="showResourceDrawer"
      :tag-key="drawerTagKey"
      :tag-value="drawerTagValue"
      @unbind="handleRefresh"
      @batch-bind="handleDrawerBatchBind"
    />
  </div>
</template>

<script setup lang="ts">
import { getTagStatsApi, listPoliciesApi, listRulesApi, listTagsApi } from '@/api/tag'
import type { ComplianceResult, ResourceRef, TagPolicy, TagResource, TagStats, TagSummary } from '@/api/types/tag'
import { getProviderLabel } from '@/utils/constants'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'
import TagBatchDialog from './components/TagBatchDialog.vue'
import TagBindDialog from './components/TagBindDialog.vue'
import type { TagFilterValues } from './components/TagFilters.vue'
import TagFilters from './components/TagFilters.vue'
import TagPolicyPanel from './components/TagPolicyPanel.vue'
import TagResourceDrawer from './components/TagResourceDrawer.vue'
import TagRulePanel from './components/TagRulePanel2.vue'
import TagStatsCards from './components/TagStatsCards.vue'

// State
const activeTab = ref<'tagList' | 'policies' | 'compliance' | 'autoTag'>('tagList')
const tableLoading = ref(false)
const tagList = ref<TagSummary[]>([])
const tagTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const selectedTags = ref<TagSummary[]>([])
const tableRef = ref()
const policyPanelRef = ref()
const policyCount = ref(0)
const complianceCount = ref(0)
const ruleCount = ref(0)
const rulePanelRef = ref()

const tagStats = reactive<TagStats>({
  total_keys: 0,
  total_values: 0,
  tagged_resources: 0,
  total_resources: 0,
  coverage_percent: 0,
})

const filters = reactive<TagFilterValues>({
  keyword: '',
  provider: '',
  resource_type: '',
})

// Drawer state
const showResourceDrawer = ref(false)
const drawerTagKey = ref('')
const drawerTagValue = ref('')

// Dialog state
const showBindDialog = ref(false)
const showBatchDialog = ref(false)
const batchMode = ref<'normal' | 'remediate' | 'resourceBind'>('normal')
const remediateResources = ref<ComplianceResult[]>([])
const remediatePolicyName = ref('')
const remediateRequiredKeys = ref<string[]>([])
const bindResourceRefs = ref<ResourceRef[]>([])

// Load tags
const loadTags = async () => {
  tableLoading.value = true
  try {
    const res = await listTagsApi({
      key: filters.keyword || undefined,
      value: filters.keyword || undefined,
      provider: filters.provider || undefined,
      resource_type: filters.resource_type || undefined,
      offset: (currentPage.value - 1) * pageSize.value,
      limit: pageSize.value,
    })
    tagList.value = res.data?.items || []
    tagTotal.value = res.data?.total || 0
  } catch {
    tagList.value = []
    tagTotal.value = 0
  } finally {
    tableLoading.value = false
  }
}

// Load stats
const loadStats = async () => {
  try {
    const res = await getTagStatsApi()
    const data = res.data
    if (data) {
      Object.assign(tagStats, data)
    }
  } catch { /* ignore */ }
}

// Load policy count for tab badge
const loadPolicyCount = async () => {
  try {
    const res = await listPoliciesApi({ offset: 0, limit: 1 })
    policyCount.value = res.data?.total || 0
  } catch { /* ignore */ }
}

// Load rule count for tab badge
const loadRuleCount = async () => {
  try {
    const res = await listRulesApi({ offset: 0, limit: 1 })
    ruleCount.value = res.data?.total || 0
  } catch { /* ignore */ }
}

const handleSearch = () => {
  currentPage.value = 1
  loadTags()
}

const handlePageSizeChange = () => {
  currentPage.value = 1
  loadTags()
}

const handleRefresh = () => {
  loadTags()
  loadStats()
  loadPolicyCount()
  loadRuleCount()
  // Update compliance count from panel if available
  if (policyPanelRef.value?.complianceData) {
    complianceCount.value = policyPanelRef.value.complianceData.non_compliant_count || 0
  }
}

const handleSelectionChange = (rows: TagSummary[]) => {
  selectedTags.value = rows
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
  selectedTags.value = []
}

const openResourceDrawer = (row: TagSummary) => {
  drawerTagKey.value = row?.key || ''
  drawerTagValue.value = row?.value || ''
  showResourceDrawer.value = true
}

const handleEdit = (row: TagSummary) => {
  // Open bind dialog pre-filled for editing
  drawerTagKey.value = row?.key || ''
  drawerTagValue.value = row?.value || ''
  showBindDialog.value = true
}

const handleUnbind = (row: TagSummary) => {
  ElMessage.info(`解绑标签 ${row?.key}=${row?.value} 的功能需要选择具体资源`)
  openResourceDrawer(row)
}

const openResourceDrawerForBatch = () => {
  // Open resource drawer for the first selected tag dimension
  if (selectedTags.value.length > 0) {
    const first = selectedTags.value[0]
    drawerTagKey.value = first?.key || ''
    drawerTagValue.value = first?.value || ''
    showResourceDrawer.value = true
  }
}

const handleRemediate = (resources: ComplianceResult[], policy: TagPolicy | null) => {
  batchMode.value = 'remediate'
  remediateResources.value = resources
  remediatePolicyName.value = policy?.name || ''
  remediateRequiredKeys.value = policy?.required_keys || []
  showBatchDialog.value = true
}

const handleDrawerBatchBind = (resources: TagResource[]) => {
  batchMode.value = 'resourceBind'
  bindResourceRefs.value = resources.map(r => ({
    account_id: r.account_id || 0,
    region: r.region || '',
    resource_type: r.resource_type || '',
    resource_id: r.asset_id || '',
  }))
  showBatchDialog.value = true
}

const handleExport = () => {
  ElMessage.info('导出功能开发中')
}

// Tag type helpers
const getValueTagType = (value?: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  if (!value) return 'info'
  const map: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    production: 'success', staging: 'primary', development: 'info',
  }
  return map[value] || 'primary'
}

const getProviderTagType = (provider?: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    aliyun: 'warning', aws: 'primary', huawei: 'danger', tencent: 'info', volcano: 'success',
  }
  return map[provider || ''] || 'info'
}

onMounted(() => {
  loadTags()
  loadStats()
  loadPolicyCount()
  loadRuleCount()
})

// Update compliance badge when panel data changes
watch(() => policyPanelRef.value?.complianceData?.non_compliant_count, (val) => {
  if (val !== undefined) complianceCount.value = val
})
</script>

<style scoped lang="scss">
.tag-management-page {
  padding: 0;
}

/* Page Header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-header-left {
  h1 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;
  }

  p {
    font-size: 13px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }
}

.page-header-right {
  display: flex;
  gap: 10px;
}

/* Tab Bar */
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 4px;
}

.tab-item {
  padding: 10px 24px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  font-weight: 500;

  &:hover {
    color: var(--text-primary);
    background: rgba(0, 0, 0, 0.02);
  }

  &.active {
    background: #409eff;
    color: #fff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
  }
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 6px;

  .tab-item.active & {
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
  }

  .tab-item:not(.active) & {
    background: #e5e6eb;
    color: var(--text-secondary);
  }
}

/* Batch Bar */
.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, #ecf5ff, rgba(64, 158, 255, 0.08));
  border: 1px solid #d9ecff;
  border-radius: 10px;
  margin-bottom: 12px;
}

.batch-left {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #409eff;
  font-size: 13px;
}

.batch-right {
  display: flex;
  gap: 8px;
}

/* Table */
.table-wrap {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  overflow: hidden;
}

.cell-link {
  color: #409eff;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

/* Pagination */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-top: none;
  border-radius: 0 0 12px 12px;
  margin-top: -1px;
}

.pagination-info {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
