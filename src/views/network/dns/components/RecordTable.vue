<template>
  <div class="record-table-wrapper">
    <!-- 工具栏 -->
    <div class="table-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          placeholder="搜索主机记录或记录值..."
          clearable
          style="width: 280px"
          @input="handleSearchInput"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="recordType" placeholder="全部类型" clearable style="width: 130px" @change="handleFilterChange">
          <el-option v-for="t in allRecordTypes" :key="t" :label="t" :value="t" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button @click="fetchData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button type="primary" @click="$emit('add')">
          <el-icon><Plus /></el-icon>
          添加记录
        </el-button>
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectedRecords.length > 0" class="batch-bar">
      <span>已选中 <strong>{{ selectedRecords.length }}</strong> 条记录</span>
      <el-button type="danger" size="small" :loading="batchDeleting" @click="$emit('batchDelete', selectedRecords)">
        <el-icon><Delete /></el-icon>
        批量删除
      </el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <!-- 表格 -->
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="recordList"
      stripe
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="40" />
      <el-table-column label="主机记录" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="mono">{{ row?.rr || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="记录类型" width="100" align="center">
        <template #default="{ row }">
          <span class="record-type-tag" :class="row?.type">{{ row?.type || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="记录值" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="mono">{{ row?.value || '-' }}</span>
          <span
            v-if="row?.linked_resource"
            class="linked-tag"
            :class="row.linked_resource.type"
            @click="handleLinkedClick(row)"
          >
            → {{ linkedLabel(row.linked_resource.type) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="TTL" width="80" align="center">
        <template #default="{ row }">
          <span class="ttl-value">{{ row?.ttl ?? '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="线路" width="80" align="center">
        <template #default="{ row }">
          {{ lineLabel(row?.line) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <span class="status-badge" :class="row?.status || 'enable'">
            <span class="status-dot"></span>
            {{ row?.status === 'disable' ? '暂停' : '启用' }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right" align="center">
        <template #default="{ row }">
          <div class="action-group">
            <el-tooltip content="编辑" placement="top">
              <el-button type="primary" link size="small" @click="$emit('edit', row)">
                <el-icon><Edit /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <el-button type="danger" link size="small" @click="$emit('delete', row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && recordList.length === 0" description="暂无解析记录" />

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
import { getDnsRecordsApi } from '@/api/dns'
import type { DnsRecord } from '@/api/types/dns'
import { Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue'
import type { TableInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

interface Props {
  domain: string
}

const props = defineProps<Props>()
defineEmits<{
  add: []
  edit: [record: DnsRecord]
  delete: [record: DnsRecord]
  batchDelete: [records: DnsRecord[]]
}>()

const router = useRouter()
const tableRef = ref<TableInstance>()
const loading = ref(false)
const batchDeleting = ref(false)
const recordList = ref<DnsRecord[]>([])
const selectedRecords = ref<DnsRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const recordType = ref('')
let searchTimer: number | null = null

const allRecordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']

const lineLabel = (line: string | undefined) => {
  const map: Record<string, string> = { default: '默认', telecom: '电信', unicom: '联通', mobile: '移动' }
  return map[line || 'default'] || line || '默认'
}

const linkedLabel = (type: string) => {
  const map: Record<string, string> = { cdn: 'CDN', waf: 'WAF', slb: 'SLB', ecs: 'ECS', eip: 'EIP' }
  return map[type] || type?.toUpperCase() || ''
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getDnsRecordsApi(props.domain, {
      keyword: keyword.value || undefined,
      record_type: recordType.value || undefined,
      offset: (page.value - 1) * pageSize.value,
      limit: pageSize.value,
    })
    const data = (res as any).data || res
    recordList.value = (data?.items || data || []).filter((item: any) => item != null)
    total.value = data?.total || 0
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '获取解析记录失败'
    ElMessage.error(msg)
    recordList.value = []
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

const handleSelectionChange = (rows: DnsRecord[]) => {
  selectedRecords.value = rows
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
}

const handleLinkedClick = (row: DnsRecord) => {
  if (!row?.linked_resource) return
  const res = row.linked_resource
  if (res.type === 'cdn') {
    router.push('/network/cdn')
  } else if (res.type === 'waf') {
    router.push('/network/waf')
  } else if (res.type === 'slb') {
    router.push('/network/lb')
  }
}

onMounted(() => {
  fetchData()
})

defineExpose({
  refresh: fetchData,
  setBatchDeleting: (val: boolean) => { batchDeleting.value = val },
})
</script>

<style scoped lang="scss">
.record-table-wrapper {
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

.batch-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  margin-bottom: 12px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.15);
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);

  strong {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.mono {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
}

.record-type-tag {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'SF Mono', 'Fira Code', monospace;

  &.A { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
  &.AAAA { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }
  &.CNAME { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
  &.MX { background: rgba(236, 72, 153, 0.15); color: #f472b6; }
  &.TXT { background: rgba(16, 185, 129, 0.15); color: #34d399; }
  &.NS { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
  &.SRV { background: rgba(239, 68, 68, 0.15); color: #f87171; }
  &.CAA { background: rgba(107, 114, 128, 0.15); color: #9ca3af; }
}

.linked-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 8px;

  &.cdn { background: rgba(6, 182, 212, 0.12); color: #22d3ee; &:hover { background: rgba(6, 182, 212, 0.25); } }
  &.waf { background: rgba(249, 115, 22, 0.12); color: #fb923c; &:hover { background: rgba(249, 115, 22, 0.25); } }
  &.slb { background: rgba(168, 85, 247, 0.12); color: #c084fc; &:hover { background: rgba(168, 85, 247, 0.25); } }
}

.ttl-value {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-secondary);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;

  &.enable {
    background: rgba(16, 185, 129, 0.12);
    color: #34d399;
    .status-dot { background: #34d399; }
  }

  &.disable {
    background: rgba(107, 114, 128, 0.12);
    color: #9ca3af;
    .status-dot { background: #9ca3af; }
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
