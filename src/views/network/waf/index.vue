<template>
  <PageContainer>
    <ManagerHeader
      title="WAF 防火墙"
      subtitle="Web应用防火墙实例管理"
      @refresh="fetchData"
    >
      <template #actions>
        <el-button type="primary" @click="handleSync">
          <el-icon><Refresh /></el-icon>
          同步实例
        </el-button>
      </template>
      <template #extra>
        <div class="stats-bar">
          <div class="stat-item">
            <span class="stat-label">总数</span>
            <span class="stat-value">{{ pagination.total }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">运行中</span>
            <span class="stat-value running">{{ activeCount }}</span>
          </div>
        </div>
      </template>
    </ManagerHeader>

    <!-- 筛选器 -->
    <div class="waf-filters">
      <div class="filters-left">
        <el-form :inline="true" class="filters-form">
          <el-form-item>
            <el-input v-model="filters.name" placeholder="搜索实例名称或ID" clearable @input="handleSearchInput" style="width: 300px">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.provider" placeholder="云厂商" clearable @change="handleSearch" style="width: 120px">
              <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.edition" placeholder="版本" clearable @change="handleSearch" style="width: 120px">
              <el-option label="基础版" value="basic" />
              <el-option label="专业版" value="pro" />
              <el-option label="企业版" value="enterprise" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="handleReset"><el-icon><RefreshLeft /></el-icon></el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- WAF 表格 -->
    <div class="waf-content">
      <el-table v-loading="loading" :data="wafList" stripe style="width: 100%" max-height="calc(100vh - 22rem)" @row-click="handleRowClick" highlight-current-row>
        <el-table-column type="selection" width="40" />
        <el-table-column label="实例ID/名称" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="id-name-cell">
              <span class="asset-id">{{ row.asset_id || '-' }}</span>
              <span v-if="row.asset_name" class="asset-name">{{ row.asset_name }}</span>
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
            <el-tag size="small" :type="getEditionTag(row.attributes?.edition)">
              {{ getEditionLabel(row.attributes?.edition) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="防护域名" width="100" align="center">
          <template #default="{ row }">
            {{ row.attributes?.domain_count || 0 }} / {{ row.attributes?.domain_limit || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="规则数" width="80" align="center">
          <template #default="{ row }">
            {{ row.attributes?.rule_count || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="QPS" width="80" align="center">
          <template #default="{ row }">
            {{ row.attributes?.qps || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="平台" width="60" align="center">
          <template #default="{ row }">
            <ProviderIcon :provider="row.provider" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="区域" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.region || '-' }}
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
    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <span class="page-size-info">本页{{ wafList.length }}条 / 共{{ pagination.total }}条</span>
        </div>
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size" :total="pagination.total" :page-sizes="[20, 50, 100]" layout="sizes, prev, pager, next, jumper" @size-change="handleSizeChange" @current-change="handlePageChange" />
      </div>
    </div>

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
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listWAFAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS } from '@/utils/constants'
import { Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import WafDetailDrawer from './components/WafDetailDrawer.vue'
import WafStatusBadge from './components/WafStatusBadge.vue'

const router = useRouter()
const loading = ref(false)
const filters = reactive({ provider: '', name: '', edition: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const wafList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)
let searchTimer: number | null = null

const activeCount = computed(() => wafList.value.filter(i =>
  ['active', 'Active', 'running'].includes(i.status)
).length)

const getEditionLabel = (edition: string | undefined) => {
  const map: Record<string, string> = { basic: '基础版', pro: '专业版', business: '商业版', enterprise: '企业版' }
  return map[edition || ''] || edition || '-'
}
const getEditionTag = (edition: string | undefined): any => {
  const map: Record<string, string> = { basic: 'info', pro: 'primary', business: 'warning', enterprise: 'danger' }
  return map[edition || ''] || 'info'
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { offset: (pagination.page - 1) * pagination.size, limit: pagination.size }
    if (filters.provider) params.provider = filters.provider
    if (filters.name) params.name = filters.name
    if (filters.edition) params.edition = filters.edition
    const res = await listWAFAssetsApi(params)
    const responseData = (res as any).data || res
    wafList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取WAF列表失败')
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
const handleReset = () => { Object.assign(filters, { provider: '', name: '', edition: '' }); handleSearch() }
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
  } catch (error: any) { ElMessage.error(error.message || '提交同步任务失败') }
  finally { syncing.value = false }
}

onMounted(() => { fetchData() })
</script>
