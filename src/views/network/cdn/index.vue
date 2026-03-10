<template>
  <PageContainer>
    <ManagerHeader
      title="CDN 加速"
      subtitle="内容分发网络加速域名管理"
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
            <span class="stat-label">在线</span>
            <span class="stat-value running">{{ onlineCount }}</span>
          </div>
        </div>
      </template>
    </ManagerHeader>

    <!-- 筛选器 -->
    <div class="cdn-filters">
      <div class="filters-left">
        <el-form :inline="true" class="filters-form">
          <el-form-item>
            <el-input v-model="filters.name" placeholder="搜索域名" clearable @input="handleSearchInput" style="width: 300px">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.provider" placeholder="云厂商" clearable @change="handleSearch" style="width: 120px">
              <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.business_type" placeholder="业务类型" clearable @change="handleSearch" style="width: 120px">
              <el-option label="网页加速" value="web" />
              <el-option label="下载加速" value="download" />
              <el-option label="流媒体" value="media" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button @click="handleReset"><el-icon><RefreshLeft /></el-icon></el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- CDN 表格 -->
    <div class="cdn-content">
      <el-table v-loading="loading" :data="cdnList" stripe style="width: 100%" max-height="calc(100vh - 22rem)" @row-click="handleRowClick" highlight-current-row>
        <el-table-column type="selection" width="40" />
        <el-table-column label="域名" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="id-name-cell">
              <span class="asset-id">{{ row.asset_name || row.asset_id || '-' }}</span>
              <span v-if="row.attributes?.cname" class="asset-name">CNAME: {{ row.attributes.cname }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <CdnStatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="业务类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getBusinessTypeTag(row.attributes?.business_type)">
              {{ getBusinessTypeLabel(row.attributes?.business_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="HTTPS" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.attributes?.https_enabled ? 'success' : 'info'" effect="plain">
              {{ row.attributes?.https_enabled ? '已开启' : '未开启' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="加速区域" width="100">
          <template #default="{ row }">
            {{ getServiceAreaLabel(row.attributes?.service_area) }}
          </template>
        </el-table-column>
        <el-table-column label="平台" width="60" align="center">
          <template #default="{ row }">
            <ProviderIcon :provider="row.provider" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.attributes?.creation_time || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="handleRowClick(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && cdnList.length === 0" description="暂无数据" />
    </div>

    <!-- 分页 -->
    <div v-if="pagination.total > 0" class="pagination-fixed">
      <div class="pagination-content">
        <div class="pagination-info">
          <span class="page-size-info">本页{{ cdnList.length }}条 / 共{{ pagination.total }}条</span>
        </div>
        <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.size" :total="pagination.total" :page-sizes="[20, 50, 100]" layout="sizes, prev, pager, next, jumper" @size-change="handleSizeChange" @current-change="handlePageChange" />
      </div>
    </div>

    <!-- 同步对话框 -->
    <el-dialog v-model="syncDialogVisible" title="同步CDN域名" width="600px">
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
    <CdnDetailDrawer v-model:visible="detailVisible" :instance="detailInstance" />
  </PageContainer>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { listCDNAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS } from '@/utils/constants'
import { Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import CdnDetailDrawer from './components/CdnDetailDrawer.vue'
import CdnStatusBadge from './components/CdnStatusBadge.vue'

const router = useRouter()
const loading = ref(false)
const filters = reactive({ provider: '', name: '', business_type: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })
const cdnList = ref<Asset[]>([])
const detailVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const syncDialogVisible = ref(false)
const syncForm = reactive({ provider: '' })
const syncing = ref(false)
let searchTimer: number | null = null

const onlineCount = computed(() => cdnList.value.filter(i =>
  ['online', 'Deployed', 'active'].includes(i.status)
).length)

const getBusinessTypeLabel = (type: string | undefined) => {
  const map: Record<string, string> = { web: '网页加速', download: '下载加速', media: '流媒体', vodDomainName: '点播', wholeSite: '全站加速' }
  return map[type || ''] || type || '-'
}
const getBusinessTypeTag = (type: string | undefined): any => {
  const map: Record<string, string> = { web: 'primary', download: 'success', media: 'warning' }
  return map[type || ''] || 'info'
}
const getServiceAreaLabel = (area: string | undefined) => {
  const map: Record<string, string> = { domestic: '中国大陆', overseas: '海外', global: '全球', mainland: '中国大陆' }
  return map[area || ''] || area || '-'
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { offset: (pagination.page - 1) * pagination.size, limit: pagination.size }
    if (filters.provider) params.provider = filters.provider
    if (filters.name) params.name = filters.name
    if (filters.business_type) params.business_type = filters.business_type
    const res = await listCDNAssetsApi(params)
    const responseData = (res as any).data || res
    cdnList.value = responseData.items || []
    pagination.total = responseData.total || 0
  } catch (error: any) {
    ElMessage.error(error.message || '获取CDN列表失败')
    cdnList.value = []
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
const handleReset = () => { Object.assign(filters, { provider: '', name: '', business_type: '' }); handleSearch() }
const handleRowClick = (row: Asset) => { detailInstance.value = row; detailVisible.value = true }
const handleSync = () => { syncForm.provider = ''; syncDialogVisible.value = true }
const submitSync = async () => {
  if (!syncForm.provider) { ElMessage.warning('请选择云厂商'); return }
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({ provider: syncForm.provider, asset_types: ['cdn'] })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    syncDialogVisible.value = false
    router.push(`/tasks/${data.task_id}`)
  } catch (error: any) { ElMessage.error(error.message || '提交同步任务失败') }
  finally { syncing.value = false }
}

onMounted(() => { fetchData() })
</script>
