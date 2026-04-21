<template>
  <div class="template-manage-page">
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
        <div
          v-for="tab in filterTabs"
          :key="tab.key"
          class="filter-tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key; loadTemplates()"
        >{{ tab.label }}</div>
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
      <div class="empty-hint">点击右上角「创建模板」开始配置您的第一个主机模板</div>
      <button class="btn btn-primary" style="margin-top: 16px" @click="handleCreate">
        <el-icon><Plus /></el-icon> 创建模板
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
            <button class="template-action-btn" title="复制" @click="handleCopy(tpl)">📋</button>
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
              {{ tpl.charge_type === 'PrePaid' ? '包年包月' : tpl.charge_type === 'PostPaid' ? '按量付费' : tpl.charge_type }}
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
import { Loading, Monitor, Plus, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ProvisionDialog from './components/ProvisionDialog.vue'
import TemplateForm from './components/TemplateForm.vue'

const router = useRouter()

const loading = ref(false)
const deleteLoading = ref(false)
const templates = ref<VMTemplate[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(12)
const searchName = ref('')
const filterProvider = ref('')
const activeTab = ref('all')
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

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 2592000000) return `${Math.floor(diff / 86400000)} 天前`
  return d.toLocaleDateString()
}

// ==================== 数据加载 ====================

async function loadTemplates() {
  loading.value = true
  try {
    const res = await listTemplatesApi({
      name: searchName.value || undefined,
      provider: filterProvider.value || undefined,
      offset: (currentPage.value - 1) * pageSize.value,
      limit: pageSize.value
    })
    const data = res?.data
    templates.value = data?.items || []
    total.value = data?.total || 0
  } catch {
    ElMessage.error('加载模板列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  currentPage.value = 1
  loadTemplates()
}

function handleFilterChange() {
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
  } catch {
    cloudAccounts.value = []
  }
}

onMounted(() => {
  loadTemplates()
  loadAccounts()
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
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
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
.stat-card.green .stat-value { color: #34d399; }

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
.template-tag.os { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.template-tag.env { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.template-tag.type { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
.template-tag.billing { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }

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
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
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
html.dark .template-manage-page {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}
html.dark .stat-card {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.1);
}
html.dark .search-box input {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
}
html.dark .search-box input:focus {
  border-color: #8b5cf6;
  background: rgba(30, 41, 59, 0.9);
}
html.dark .filter-select {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.15);
  color: #e2e8f0;
}
html.dark .filter-select option {
  background: #1e293b;
}
html.dark .filter-tabs {
  background: rgba(30, 41, 59, 0.6);
}
html.dark .template-card {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.1);
}
html.dark .template-card:hover {
  border-color: rgba(139, 92, 246, 0.3);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}
html.dark .template-card-header {
  border-bottom-color: rgba(148, 163, 184, 0.1);
}
html.dark .template-tags {
  border-top-color: rgba(148, 163, 184, 0.1);
}
html.dark .template-card-footer {
  background: rgba(15, 23, 42, 0.3);
}
html.dark .template-action-btn {
  background: rgba(148, 163, 184, 0.1);
  color: #64748b;
}
html.dark .template-action-btn:hover {
  background: rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}
html.dark .btn-secondary {
  background: rgba(30, 41, 59, 0.8);
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.2);
}
html.dark .btn-secondary:hover {
  background: rgba(30, 41, 59, 1);
  color: #e2e8f0;
}
</style>
