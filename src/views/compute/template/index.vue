<template>
  <div class="template-manage-page">
    <!-- 读屏播报（iter349）：本页不用 DataTable，拿不到 iter348 的共享收益 -->
    <LiveStatus :text="liveStatusText" />

    <!-- 页面标题 -->
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 主机模板管理</h1>
        <p class="page-subtitle">预置主机配置模板，快速创建标准化云主机实例</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" @click="$router.push('/compute/template/create')">
          <el-icon><Monitor /></el-icon> 直接创建云主机
        </button>
        <button class="btn btn-primary" @click="$router.push('/compute/template/create?mode=template')">
          <el-icon><Plus /></el-icon> 创建模板
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card purple">
        <div class="stat-icon-wrap purple"><span>📋</span></div>
        <div class="stat-value">{{ total }}</div>
        <div class="stat-label">模板总数</div>
      </div>
      <div class="stat-card pink">
        <div class="stat-icon-wrap pink"><span>🚀</span></div>
        <div class="stat-value">{{ totalUsageCount }}</div>
        <div class="stat-label">使用次数</div>
      </div>
      <div class="stat-card cyan">
        <div class="stat-icon-wrap cyan"><span>☁️</span></div>
        <div class="stat-value">{{ providerCount }}</div>
        <div class="stat-label">覆盖云厂商</div>
      </div>
      <div class="stat-card green">
        <div class="stat-icon-wrap green"><span>⭐</span></div>
        <div class="stat-value">{{ safeTemplates.length }}</div>
        <div class="stat-label">当前模板</div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="search-box">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          v-model="searchName"
          type="text"
          placeholder="搜索模板名称、描述..."
          @input="handleSearch"
          @change="commitSearchToUrl"
        />
      </div>
      <select v-model="filterProvider" class="filter-select" @change="handleFilterChange">
        <option value="">全部云厂商</option>
        <option value="aliyun">阿里云</option>
        <option value="aws">AWS</option>
        <option value="huawei">华为云</option>
        <option value="tencent">腾讯云</option>
        <option value="volcano">火山引擎</option>
      </select>
      <div class="filter-tabs">
        <!-- F-C4（compute-2）：「最近使用/我的模板」两个 tab 未参与请求参数（点击后列表不变），按主题 B 决策禁用 + tooltip -->
        <el-tooltip
          v-for="tab in filterTabs"
          :key="tab.key"
          content="功能开发中"
          placement="top"
          :disabled="!isTabDisabled(tab.key)"
        >
          <div
            class="filter-tab"
            :class="{ active: activeTab === tab.key, 'is-disabled': isTabDisabled(tab.key) }"
            @click="handleFilterTabClick(tab.key)"
          >{{ tab.label }}</div>
        </el-tooltip>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="safeTemplates.length === 0" class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">暂无模板</div>
      <div class="empty-hint">点右上角「创建模板」进入完整配置页；也可点下方按钮在当前页快速创建</div>
      <button
        class="btn btn-primary"
        style="margin-top: 16px"
        title="在本页以抽屉快速创建（字段较少）；需要完整配置请用右上角「创建模板」"
        @click="handleCreate"
      >
        <el-icon><Plus /></el-icon> 快速创建
      </button>
    </div>

    <!-- 模板卡片网格 -->
    <div v-else class="template-grid">
      <div
        v-for="tpl in safeTemplates"
        :key="tpl?.id"
        class="template-card"
      >
        <!-- 卡片头部 -->
        <div class="template-card-header">
          <div class="template-icon" :class="tpl?.provider || 'default'">
            {{ getTemplateEmoji(tpl) }}
          </div>
          <div class="template-header-info">
            <div class="template-name-row">
              <span class="template-name">{{ tpl?.name || '未命名模板' }}</span>
              <span class="cloud-badge" :class="tpl?.provider || 'default'">
                {{ getProviderShort(tpl?.provider) }}
              </span>
            </div>
            <div class="template-desc">{{ tpl?.description || getProviderLabel(tpl?.provider || '') + ' · 主机模板' }}</div>
          </div>
          <div class="template-actions">
            <button class="template-action-btn primary" title="使用模板" @click="handleProvision(tpl)">🚀</button>
            <button class="template-action-btn" title="编辑" @click="handleEdit(tpl)">✏️</button>
            <button class="template-action-btn" title="复制" :disabled="copying" @click="handleCopy(tpl)">📋</button>
            <button class="template-action-btn danger" title="删除" @click="handleDeleteConfirm(tpl)">🗑️</button>
          </div>
        </div>

        <!-- 卡片内容 -->
        <div class="template-card-body">
          <div class="template-specs">
            <div class="spec-item">
              <span class="spec-icon">💻</span>
              <div>
                <div class="spec-label">规格</div>
                <div class="spec-value">{{ tpl?.instance_type || '-' }}</div>
              </div>
            </div>
            <div class="spec-item">
              <span class="spec-icon">💿</span>
              <div>
                <div class="spec-label">系统盘</div>
                <div class="spec-value">{{ formatDisk(tpl) }}</div>
              </div>
            </div>
            <div class="spec-item">
              <span class="spec-icon">🌐</span>
              <div>
                <div class="spec-label">公网带宽</div>
                <div class="spec-value">{{ tpl?.bandwidth_out ? tpl.bandwidth_out + ' Mbps' : '仅内网' }}</div>
              </div>
            </div>
            <div class="spec-item">
              <span class="spec-icon">📍</span>
              <div>
                <div class="spec-label">区域</div>
                <div class="spec-value">{{ tpl?.region || '-' }}</div>
              </div>
            </div>
          </div>

          <!-- 标签 -->
          <div class="template-tags">
            <span v-if="tpl?.region" class="template-tag env">{{ tpl.region }}</span>
            <span v-if="tpl?.charge_type" class="template-tag billing">
              {{ labelOfLenient(CHARGE_TYPE_LABELS, tpl.charge_type) }}
            </span>
            <span
              v-for="(val, key) in (tpl?.tags || {})"
              :key="String(key)"
              class="template-tag type"
            >{{ key }}={{ val }}</span>
          </div>
        </div>

        <!-- 卡片底部 -->
        <div class="template-card-footer">
          <span class="template-meta">
            {{ tpl?.created_at ? formatTime(tpl.created_at) : '' }}
          </span>
          <button class="template-use-btn" @click="handleProvision(tpl)">使用模板</button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next"
        @size-change="loadTemplates"
        @current-change="loadTemplates"
      />
    </div>

    <!-- 创建/编辑模板抽屉 -->
    <TemplateForm
      v-model:visible="showCreateForm"
      :template-data="editingTemplate"
      :accounts="accountOptions"
      @success="handleFormSuccess"
    />

    <!-- 基于模板创建主机对话框 -->
    <ProvisionDialog
      v-model:visible="showProvisionDialog"
      :template-data="provisionTemplate"
      @success="handleProvisionSuccess"
    />

    <!-- 删除确认 -->
    <el-dialog v-model="showDeleteDialog" title="删除模板" width="400px" :close-on-click-modal="false">
      <p>确定要删除模板「{{ deletingTemplate?.name }}」吗？此操作不可恢复。</p>
      <template #footer>
        <el-button @click="showDeleteDialog = false">取消</el-button>
        <el-button type="danger" :loading="deleteLoading" @click="confirmDelete">确定删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api/index'
import { createTemplateApi, deleteTemplateApi, listTemplatesApi } from '@/api/template'
import type { CloudAccount } from '@/api/types/account'
import type { VMTemplate } from '@/api/types/template'
import { getProviderLabel } from '@/utils/constants'
import { clampPageAfterTotalChange } from '@/utils/clampPage'
import { CHARGE_TYPE_LABELS, labelOfLenient } from '@/utils/fieldLabels'
import { Loading, Monitor, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useUrlFilters } from '@/composables/useUrlFilters'
import { useRouter } from 'vue-router'
import { formatTemplateTime } from './format'
import ProvisionDialog from './components/ProvisionDialog.vue'
import TemplateForm from './components/TemplateForm.vue'

const router = useRouter()

const loading = ref(false)
const deleteLoading = ref(false)
const copying = ref(false)
const templates = ref<VMTemplate[]>([])
const total = ref(0)

/** 读屏播报文案（iter349）：加载中 → 空/条数 */
const liveStatusText = computed(() => {
  if (loading.value) return '正在加载主机模板…'
  if (total.value === 0) return '暂无主机模板'
  return `共 ${total.value} 个主机模板`
})
const currentPage = ref(1)
const pageSize = ref(12)

// 列表请求竞态守卫（iter281）：翻页连点时只认最后一次请求的结果
const latestRequest = useLatestRequest()
const searchName = ref('')
const filterProvider = ref('')
const activeTab = ref('all')

// 筛选同步 URL（iter149）：searchName / filterProvider / activeTab 此前只存在内存里，
// 刷新、分享链接、或从详情/弹窗返回时筛选与页签全部丢失（实测：输入关键词后行数变化，URL 不变）。
// 三者都是字符串，用默认编码即可；activeTab 作为「当前视图」也一并同步。
const urlFilters = reactive<Record<string, string | undefined>>({
  search: searchName.value || undefined,
  provider: filterProvider.value || undefined,
  tab: activeTab.value || undefined,
})
useUrlFilters(urlFilters)
// 文本搜索**不在每次按键时写 URL**（iter315 实测的 P1 缺陷）：
// `MainLayout` 的 `<router-view :key="route.fullPath" />` 意味着 query 一变就**重挂载整页**，
// 于是「输入第 1 个字符 → 写 URL → 页面重挂载 → 输入框被销毁重建 → 焦点丢失」，
// 实测搜索框**只能输入 1 个字符**（打 x 后再打 y/z 全部丢失，`document.activeElement` 不再是输入框，
// 且新旧输入框不是同一个 DOM 节点）。
// 因此改为**提交时机**才写 URL（原生 `change`：失焦或回车，值有变时触发），
// 既保留 iter149 的「刷新 / 分享链接 / 返回后筛选不丢」，又不会打断输入过程。
function commitSearchToUrl(): void {
  urlFilters.search = searchName.value || undefined
}
watch(filterProvider, (v) => { urlFilters.provider = v || undefined })
watch(activeTab, (v) => { urlFilters.tab = v || undefined })
// URL 回填后同步到各自的 ref（setup 阶段完成，早于 onMounted 的 loadTemplates）
if (urlFilters.search && !searchName.value) searchName.value = String(urlFilters.search)
if (urlFilters.provider && !filterProvider.value) filterProvider.value = String(urlFilters.provider)
if (urlFilters.tab && !activeTab.value) activeTab.value = String(urlFilters.tab)
const showCreateForm = ref(false)
const editingTemplate = ref<VMTemplate | null>(null)
const showProvisionDialog = ref(false)
const provisionTemplate = ref<VMTemplate | null>(null)
const showDeleteDialog = ref(false)
const deletingTemplate = ref<VMTemplate | null>(null)
const cloudAccounts = ref<CloudAccount[]>([])

const filterTabs = [
  { key: 'all', label: '全部' },
  { key: 'recent', label: '最近使用' },
  { key: 'my', label: '我的模板' }
]

// F-C4（compute-2）：「最近使用/我的模板」未参与请求参数，先禁用；待排序/归属过滤参数落地后再放开
const isTabDisabled = (key: string) => key !== 'all'

const handleFilterTabClick = (key: string) => {
  if (isTabDisabled(key)) return
  activeTab.value = key
  loadTemplates()
}

const safeTemplates = computed(() =>
  (templates.value || []).filter(item => item != null)
)

const accountOptions = computed(() =>
  (cloudAccounts.value || []).filter(item => item != null).map(acc => ({
    id: acc?.id,
    name: `${acc?.name || ''} (${getProviderLabel(acc?.provider || '')})`,
    provider: acc?.provider,
    regions: acc?.regions || (acc?.region ? [acc.region] : [])
  }))
)

const totalUsageCount = computed(() => {
  return safeTemplates.value.reduce((sum, t) => sum + (t?.usage_count || 0), 0)
})

const providerCount = computed(() => {
  const providers = new Set(safeTemplates.value.map(t => t?.provider).filter(Boolean))
  return providers.size
})

// ==================== 工具函数 ====================

function getProviderShort(provider: string | undefined): string {
  if (!provider) return '?'
  const shorts: Record<string, string> = {
    aliyun: '阿里云', aws: 'AWS', huawei: '华为云',
    tencent: '腾讯云', volcano: '火山', azure: 'Azure'
  }
  return shorts[provider] || provider
}

function getTemplateEmoji(tpl: VMTemplate | null): string {
  if (!tpl) return '📋'
  const name = (tpl.name || '').toLowerCase()
  if (name.includes('web') || name.includes('nginx')) return '🖥️'
  if (name.includes('mysql') || name.includes('数据库') || name.includes('db') || name.includes('rds')) return '🗄️'
  if (name.includes('gpu') || name.includes('训练') || name.includes('ai')) return '🎮'
  if (name.includes('k8s') || name.includes('kubernetes') || name.includes('容器')) return '🐳'
  if (name.includes('测试') || name.includes('test') || name.includes('dev')) return '🧪'
  if (name.includes('海外') || name.includes('overseas') || name.includes('global')) return '🌍'
  return '📋'
}

function formatDisk(tpl: VMTemplate | null): string {
  if (!tpl) return '-'
  const size = tpl.system_disk_size || 0
  const type = tpl.system_disk_type || ''
  if (!size) return '-'
  const typeLabel = type === 'cloud_ssd' ? 'SSD' : type === 'cloud_essd' ? 'ESSD' : type === 'cloud_efficiency' ? '高效' : type || ''
  return `${size}GB ${typeLabel}`
}

const formatTime = (ts: number) => formatTemplateTime(ts)

// ==================== 数据加载 ====================

async function loadTemplates() {
  // 竞态守卫（iter281）：翻页连点时，第 2 页的慢响应会晚于第 3 页返回，
  // 若不判断就会把列表覆盖回第 2 页的数据 —— 表现为「页码是 3、数据是第 2 页」。
  const seq = latestRequest.begin()
  loading.value = true
  try {
    const res = await listTemplatesApi({
      name: searchName.value || undefined,
      provider: filterProvider.value || undefined,
      offset: (currentPage.value - 1) * pageSize.value,
      limit: pageSize.value
    })
    const data = res?.data
    // 已有更新的请求发出：本次结果作废，不写任何状态（含 loading，交给最新那次收尾）
    if (!latestRequest.isCurrent(seq)) return
    const newTotal = data?.total || 0
    // 页码收敛（iter168）：删除当前页最后一条时，currentPage 不变 → 请求到空页。
    // 搜索/筛选已各自重置到第 1 页（handleSearch/handleFilterChange），这里只需处理删除场景。
    const fixedPage = clampPageAfterTotalChange(currentPage.value, newTotal, pageSize.value)
    if (fixedPage !== currentPage.value) {
      currentPage.value = fixedPage
      templates.value = []
      total.value = newTotal
      await loadTemplates()
      return
    }
    templates.value = data?.items || []
    total.value = newTotal
  } catch {
    // 旧请求的失败不该弹提示（新请求可能已成功）
    if (!latestRequest.isCurrent(seq)) return
    ElMessage.error('加载模板列表失败')
  } finally {
    if (latestRequest.isCurrent(seq)) loading.value = false
  }
}

/**
 * 搜索框输入（iter296）。
 *
 * 缺陷（实测）：`@input` 直接调 `loadTemplates()`，**没有任何防抖** ——
 * 用中文输入法输入「阿里云」时，拼音阶段的每个按键都会发一次请求，
 * 实测一次输入产生 **7 次** `GET /templates`（应为 1 次）。
 * 既浪费后端，也会让列表在输入过程中反复闪烁。
 *
 * 处理：与仓内既有做法对齐（`cert/ledger/CertTable`、`cert/detail/ForwardReferences`、
 * `cert/probes` 均为 300ms 防抖），这里同样用 300ms。
 *
 * 关于「清空立即生效」：照 `cert/probes` 的做法，清空时不等待防抖。
 * **但必须只认「从有值变为空」那一次** —— 我第一版写成 `if (!searchName.value)`，
 * 结果踩到坑：中文输入法组合期间 `v-model` 不更新，`searchName` 恰好也是空串，
 * 于是拼音的每个按键都走进「清空」分支立即发请求（实测仍发出 4 次无参请求）。
 * 因此这里用 `wasNonEmpty` 记住上一次是否非空，只有真正「删空」才立即搜索。
 */
let searchTimer: ReturnType<typeof setTimeout> | null = null
// 上一次输入后的非空状态；用于区分「用户删空」与「输入法组合期间的空值」
let wasNonEmpty = false

function handleSearch() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  const nowEmpty = !searchName.value
  if (nowEmpty && wasNonEmpty) {
    // 真正的清空动作（点 clearable 的 ×，或手动删掉最后一个字）：立即搜索
    wasNonEmpty = false
    currentPage.value = 1
    loadTemplates()
    return
  }
  if (!nowEmpty) wasNonEmpty = true
  // 其余情况（包括输入法组合期间的空值）一律走防抖，避免拼音逐键发请求
  searchTimer = setTimeout(() => {
    searchTimer = null
    currentPage.value = 1
    loadTemplates()
  }, 300)
}

function handleFilterChange() {
  // 筛选是离散选择（下拉），不存在连打，直接触发；但要取消可能待发的搜索
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
  currentPage.value = 1
  loadTemplates()
}

// ==================== 模板操作 ====================

function handleCreate() {
  editingTemplate.value = null
  showCreateForm.value = true
}

function handleEdit(tpl: VMTemplate | null) {
  if (!tpl) return
  router.push(`/compute/template/create?mode=template&edit=${tpl.id}`)
}

function handleProvision(tpl: VMTemplate | null) {
  if (!tpl) return
  provisionTemplate.value = tpl
  showProvisionDialog.value = true
}

async function handleCopy(tpl: VMTemplate | null) {
  if (!tpl) return
  if (copying.value) return
  copying.value = true
  try {
    await createTemplateApi({
      name: `${tpl.name || '模板'} - 副本`,
      description: tpl.description,
      provider: tpl.provider,
      cloud_account_id: tpl.cloud_account_id,
      region: tpl.region,
      zone: tpl.zone,
      instance_type: tpl.instance_type,
      image_id: tpl.image_id,
      vpc_id: tpl.vpc_id,
      subnet_id: tpl.subnet_id,
      security_group_ids: tpl.security_group_ids,
      instance_name_prefix: tpl.instance_name_prefix,
      host_name_prefix: tpl.host_name_prefix,
      system_disk_type: tpl.system_disk_type,
      system_disk_size: tpl.system_disk_size,
      data_disks: tpl.data_disks,
      bandwidth_out: tpl.bandwidth_out,
      charge_type: tpl.charge_type,
      key_pair_name: tpl.key_pair_name,
      tags: tpl.tags
    })
    ElMessage.success('模板复制成功')
    loadTemplates()
  } catch {
    ElMessage.error('复制模板失败')
  } finally {
    copying.value = false
  }
}

function handleDeleteConfirm(tpl: VMTemplate | null) {
  if (!tpl) return
  deletingTemplate.value = tpl
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!deletingTemplate.value) return
  deleteLoading.value = true
  try {
    await deleteTemplateApi(deletingTemplate.value.id)
    ElMessage.success('删除成功')
    showDeleteDialog.value = false
    deletingTemplate.value = null
    loadTemplates()
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleteLoading.value = false
  }
}

function handleFormSuccess() {
  showCreateForm.value = false
  editingTemplate.value = null
  loadTemplates()
}

function handleProvisionSuccess() {
  showProvisionDialog.value = false
  provisionTemplate.value = null
  ElMessage.success('创建任务已提交')
}

async function loadAccounts() {
  try {
    const res = await listCloudAccountsApi({ status: 'active', limit: 100 })
    const data = res?.data
    cloudAccounts.value = data?.accounts || []
  } catch (e) {
    console.error('加载云账号失败:', e)
    ElMessage.error('加载云账号失败')
    cloudAccounts.value = []
  }
}

onMounted(() => {
  loadTemplates()
  loadAccounts()
})
// 卸载时作废在途请求，避免组件已销毁还写状态
onUnmounted(() => {
  latestRequest.reset()
  // 卸载时清掉待发的搜索防抖（iter296），避免组件已销毁还发请求
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
})

</script>

<style scoped>
.template-manage-page {
  padding: 24px 32px;
  min-height: 100%;
}

/* 页面标题 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}
.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.page-subtitle {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.page-actions {
  display: flex;
  gap: 12px;
}

/* 按钮 */
.btn {
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-secondary {
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color);
}
.btn-secondary:hover {
  background: var(--el-fill-color-dark);
  color: var(--el-text-color-primary);
}
.btn-primary {
  /* iter393: 白字压在 #8b5cf6→#ec4899 上只有 4.23 / 3.53，压暗 15% 后 5.55 / 4.69。*/
  background: linear-gradient(135deg, color-mix(in srgb, #8b5cf6 85%, #000), color-mix(in srgb, #ec4899 85%, #000));
  color: #fff;
  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
}
.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}
.stat-card {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 14px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
}
.stat-card.purple::before { background: linear-gradient(90deg, #8b5cf6, #a78bfa); }
.stat-card.pink::before { background: linear-gradient(90deg, #ec4899, #f472b6); }
.stat-card.cyan::before { background: linear-gradient(90deg, #06b6d4, #22d3ee); }
.stat-card.green::before { background: linear-gradient(90deg, #10b981, #34d399); }

.stat-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 12px;
}
.stat-icon-wrap.purple { background: rgba(139, 92, 246, 0.15); }
.stat-icon-wrap.pink { background: rgba(236, 72, 153, 0.15); }
.stat-icon-wrap.cyan { background: rgba(6, 182, 212, 0.15); }
.stat-icon-wrap.green { background: rgba(16, 185, 129, 0.15); }

.stat-value {
  font-size: 28px;
  font-weight: 700;
}
.stat-card.purple .stat-value { color: #a78bfa; }
.stat-card.pink .stat-value { color: #f472b6; }
.stat-card.cyan .stat-value { color: #22d3ee; }
.stat-card.green .stat-value { color: var(--accent-green); }

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

/* 工具栏 */
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}
.search-box {
  flex: 1;
  min-width: 280px;
  position: relative;
}
.search-box input {
  width: 100%;
  padding: 10px 16px 10px 40px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
}
.search-box input:focus {
  border-color: #8b5cf6;
}
.search-box input::placeholder {
  color: var(--el-text-color-placeholder);
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--el-text-color-placeholder);
}
.filter-select {
  padding: 10px 36px 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color);
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  font-size: 14px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}
.filter-select option {
  background: var(--el-bg-color);
}
.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}
.filter-tab {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.filter-tab:hover {
  color: var(--el-text-color-primary);
}
/* F-C4（compute-2）：未实现 tab 禁用态 */
.filter-tab.is-disabled,
.filter-tab.is-disabled:hover {
  color: var(--el-text-color-placeholder);
  cursor: not-allowed;
}
.filter-tab.active {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

/* 加载 & 空状态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  gap: 12px;
  color: var(--el-text-color-secondary);
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
}
.empty-icon { font-size: 48px; margin-bottom: 16px; }
.empty-text { font-size: 16px; font-weight: 600; color: var(--el-text-color-primary); }
.empty-hint { font-size: 13px; color: var(--el-text-color-secondary); margin-top: 8px; }

/* 模板卡片网格 */
.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

/* 卡片最小 360px：390 视口内容区仅约 302px，会撑出容器（实测溢出 78px），
   并把「使用模板」按钮裁到视口外。窄屏退化为单列满宽。 */
@media (max-width: 768px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
.template-card {
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}
.template-card:hover {
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-4px);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
}

/* 卡片头部 */
.template-card-header {
  padding: 20px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  display: flex;
  align-items: flex-start;
  gap: 14px;
}
.template-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.template-icon.aliyun { background: rgba(255, 106, 0, 0.15); }
.template-icon.tencent { background: rgba(0, 163, 255, 0.15); }
.template-icon.huawei { background: rgba(199, 0, 11, 0.15); }
.template-icon.aws { background: rgba(255, 153, 0, 0.15); }
.template-icon.volcano { background: rgba(245, 63, 63, 0.15); }
.template-icon.default { background: rgba(148, 163, 184, 0.15); }

.template-header-info {
  flex: 1;
  min-width: 0;
}
.template-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.template-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cloud-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
.cloud-badge.aliyun { background: rgba(255, 106, 0, 0.18); color: #ff9500; }
.cloud-badge.tencent { background: rgba(0, 163, 255, 0.18); color: #22d3ee; }
.cloud-badge.huawei { background: rgba(199, 0, 11, 0.18); color: #ff6b6b; }
.cloud-badge.aws { background: rgba(255, 153, 0, 0.18); color: #ffb84d; }
.cloud-badge.volcano { background: rgba(245, 63, 63, 0.18); color: #ff7a7a; }
.cloud-badge.default { background: rgba(148, 163, 184, 0.18); color: #94a3b8; }

.template-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.template-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.template-action-btn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: none;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.template-action-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}
.template-action-btn.primary {
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
}
.template-action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
.template-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.template-action-btn:disabled:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

/* 卡片内容 */
.template-card-body {
  padding: 20px;
}
.template-specs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}
.spec-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
.spec-icon {
  font-size: 16px;
}
.spec-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.spec-value {
  font-size: 13px;
  color: var(--el-text-color-primary);
  font-weight: 500;
}

/* 标签 */
.template-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-extra-light);
}
.template-tag {
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
}
/* iter398: 这几枚标签原本写死深色主题的粉彩色（#34d399 等），压在自己的浅底纹上只有 1.7~2.6。*/
/* env 这枚改用主题感知的 --accent-green（深色 #10b981 / 浅色 #087050），一次覆盖两个主题。*/
.template-tag.os { background: rgba(113, 112, 255, 0.15); color: #818cf8; }
.template-tag.env { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
.template-tag.type { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
.template-tag.billing { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }

/* 卡片底部 */
.template-card-footer {
  padding: 14px 20px;
  background: var(--el-fill-color-lighter);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.template-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.template-use-btn {
  padding: 8px 18px;
  border-radius: 8px;
  /* iter393: 白字压在 #8b5cf6→#ec4899 上只有 4.23 / 3.53，压暗 15% 后 5.55 / 4.69。*/
  background: linear-gradient(135deg, color-mix(in srgb, #8b5cf6 85%, #000), color-mix(in srgb, #ec4899 85%, #000));
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}
.template-use-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

/* 分页 */
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}

/* ==================== 深色模式适配 ==================== */
html.dark:not(.light) .template-manage-page {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}
html.dark:not(.light) .stat-card {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.1);
}
html.dark:not(.light) .search-box input {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
}
html.dark:not(.light) .search-box input:focus {
  border-color: #8b5cf6;
  background: rgba(30, 41, 59, 0.9);
}
html.dark:not(.light) .filter-select {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
}
html.dark:not(.light) .filter-select option {
  background: #1e293b;
}
html.dark:not(.light) .filter-tabs {
  background: rgba(30, 41, 59, 0.6);
}
html.dark:not(.light) .template-card {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.1);
}
html.dark:not(.light) .template-card:hover {
  border-color: rgba(139, 92, 246, 0.3);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}
html.dark:not(.light) .template-card-header {
  border-bottom-color: rgba(148, 163, 184, 0.1);
}
html.dark:not(.light) .template-tags {
  border-top-color: rgba(148, 163, 184, 0.1);
}
html.dark:not(.light) .template-card-footer {
  background: rgba(15, 23, 42, 0.3);
}
html.dark:not(.light) .template-action-btn {
  background: rgba(148, 163, 184, 0.1);
  /* iter383: #64748b(slate-600) 在 rgba(148,163,184,.1) 底上只有 3.05:1，提到 #94a3b8(slate-400) = 5.64 */
  color: #94a3b8;
}
html.dark:not(.light) .template-action-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}
html.dark:not(.light) .btn-secondary {
  background: rgba(30, 41, 59, 0.8);
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.2);
}
html.dark:not(.light) .btn-secondary:hover {
  background: rgba(30, 41, 59, 1);
  color: #e2e8f0;
}

/* TEMPLATE_MOBILE_NO_OVERFLOW：窄屏下模板页三处溢出（390 卡片撑出 78px、360 搜索框 280px、规格项 102px） */
@media (max-width: 768px) {
  /* 页头：.page-header 是 display:flex + space-between 的单行，左侧标题块与右侧动作组抢宽度，
     390px 下标题只分到 72px，「📋 主机模板管理」被折成 3 行（iter127 实测）。
     让页头换行、标题块独占一行。 */
  .page-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .page-header > div {
    flex: 1 0 100%;
  }

  /* 卡片头部：窄屏下 info 会被压到 0 宽（模板名消失），4 个操作按钮被 overflow:hidden 裁掉。
     让头部换行、信息区独占一行、按钮组右对齐。 */
  .template-card-header {
    flex-wrap: wrap;
    row-gap: 10px;
  }

  .template-header-info {
    flex: 1 1 100%;
  }

  .template-actions {
    margin-left: auto;
  }

  /* 统计卡四列在 320 下被挤到 42px，图标溢出（实测 16px） */
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .search-box {
    /* flex:1 = flex-basis:0%，会把宽度压到 74px（实测 360）；basis 改 100% 才能独占一行 */
    flex: 1 1 100%;
    min-width: 0;
    width: 100%;
  }

  .template-specs {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  /* 320 下 .spec-item 的 min-content（132px）略大于轨道（126px），溢出 6px：
     收紧间距并让标签走省略号，保证数值仍完整可见 */
  .spec-item {
    min-width: 0;
    gap: 6px;
  }

  .spec-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
