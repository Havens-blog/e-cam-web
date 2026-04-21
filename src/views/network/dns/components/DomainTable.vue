<template>
  <div class="domain-table-wrapper">
    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          placeholder="搜索域名..."
          clearable
          style="width: 260px"
          @input="handleSearchInput"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="provider" placeholder="全部云厂商" clearable style="width: 140px" @change="handleFilterChange">
          <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button @click="fetchData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-tooltip content="DNS 通过云账号同步网络资源时自动同步" placement="top">
          <el-button type="primary" @click="router.push('/account')">
            <el-icon><Refresh /></el-icon>
            同步实例
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 表格 -->
    <el-table v-loading="loading" :data="domainList" stripe style="width: 100%">
      <el-table-column label="域名" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="domain-link" @click="handleViewRecords(row)">{{ row?.domain_name || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="云厂商" width="140">
        <template #default="{ row }">
          <span class="provider-badge" :class="row?.provider">
            <ProviderIcon :provider="row?.provider || ''" size="small" />
            {{ getProviderLabel(row?.provider || '') }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="云账号" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="mono">{{ row?.account_name || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="解析记录数" width="120" align="center">
        <template #default="{ row }">
          <span class="record-count">{{ row?.record_count ?? 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <span class="status-badge" :class="row?.status || 'normal'">
            <span class="status-dot"></span>
            {{ statusLabel(row?.status) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right" align="center">
        <template #default="{ row }">
          <div class="action-group">
            <el-tooltip content="查看拓扑" placement="top">
              <el-button type="primary" link size="small" @click="handleViewTopo(row)">
                <el-icon><Share /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="查看记录" placement="top">
              <el-button type="primary" link size="small" @click="handleViewRecords(row)">
                <el-icon><List /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && domainList.length === 0" description="暂无数据" />

    <!-- 分页 -->
    <div v-if="total > 0" class="pagination-bar">
      <span class="pagination-info">共 {{ total }} 条</span>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { getDnsDomainsApi } from '@/api/dns'
import type { DnsDomain } from '@/api/types/dns'
import ProviderIcon from '@/components/ProviderIcon.vue'
import { CLOUD_PROVIDERS, getProviderLabel } from '@/utils/constants'
import { List, Refresh, Search, Share } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

const router = useRouter()
const loading = ref(false)
const domainList = ref<DnsDomain[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const provider = ref('')
let searchTimer: number | null = null

const statusLabel = (status: string | undefined) => {
  const map: Record<string, string> = { normal: '正常', paused: '暂停', locked: '锁定' }
  return map[status || 'normal'] || status || '正常'
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getDnsDomainsApi({
      keyword: keyword.value || undefined,
      provider: provider.value || undefined,
      offset: (page.value - 1) * pageSize.value,
      limit: pageSize.value,
    })
    const data = (res as any).data || res
    domainList.value = (data?.items || data || []).filter((item: any) => item != null)
    total.value = data?.total || 0
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取域名列表失败'
    ElMessage.error(msg)
    domainList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    page.value = 1
    fetchData()
  }, 500)
}

const handleFilterChange = () => {
  page.value = 1
  fetchData()
}

const handleSizeChange = () => {
  page.value = 1
  fetchData()
}

const handlePageChange = () => {
  fetchData()
}

const handleViewRecords = (row: DnsDomain) => {
  router.push(`/network/dns/${row?.domain_name}/records`)
}

const handleViewTopo = (row: DnsDomain) => {
  router.push(`/topology?domain=${row?.domain_name}`)
}

onMounted(() => {
  fetchData()
})

defineExpose({ refresh: fetchData })
</script>

<style scoped lang="scss">
.domain-table-wrapper {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 16px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.domain-link {
  color: var(--el-color-primary);
  cursor: pointer;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.record-count {
  color: var(--el-color-primary);
  font-weight: 600;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;

  &.normal {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;

    .status-dot { background: #34d399; }
  }

  &.paused {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;

    .status-dot { background: #fbbf24; }
  }

  &.locked {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;

    .status-dot { background: #f87171; }
  }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.action-group {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.06));

  .pagination-info {
    font-size: 13px;
    color: var(--text-secondary);
  }
}
</style>
