<template>
  <div class="database-page">
    <!-- 页面头部 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">MongoDB 云数据库</h1>
        <div class="tab-nav">
          <span class="tab-item active">全部</span>
          <span class="tab-item">公有云</span>
        </div>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ pagination.total }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">运行中</span>
            <span class="stat-num blue">{{ runningCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">已停止</span>
            <span class="stat-num">{{ stoppedCount }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="action-left">
        <el-input v-model="filters.keyword" placeholder="搜索实例名称/ID" style="width: 240px" clearable @keyup.enter="handleSearch" @clear="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.provider" placeholder="云平台" clearable style="width: 120px" @change="handleSearch">
          <el-option label="阿里云" value="aliyun" />
          <el-option label="腾讯云" value="tencent" />
          <el-option label="华为云" value="huawei" />
          <el-option label="AWS" value="aws" />
          <el-option label="火山引擎" value="volcano" />
        </el-select>
        <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px" @change="handleSearch">
          <el-option label="运行中" value="running" />
          <el-option label="已停止" value="stopped" />
          <el-option label="创建中" value="creating" />
        </el-select>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ instances.length }}条 / 选中{{ selectedIds.length }}条 / 共{{ pagination.total }}条</span>
        <el-button size="small" circle @click="handleRefresh" title="刷新"><el-icon><Refresh /></el-icon></el-button>
        <el-button size="small" circle @click="exportDialogVisible = true" title="导出"><el-icon><Download /></el-icon></el-button>
        <el-button size="small" circle @click="columnSettingsVisible = true" title="自定义列"><el-icon><Setting /></el-icon></el-button>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-wrapper">
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-checkbox"><el-checkbox v-model="selectAll" @change="handleSelectAll" /></th>
              <th class="col-name">名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">{{ col.label }}</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>

      <div class="table-body" v-loading="loading">
        <table class="data-table">
          <tbody>
            <tr v-for="item in instances" :key="item.id" :class="{ selected: selectedIds.includes(item.id) }" @click="handleRowClick(item)">
              <td class="col-checkbox" @click.stop><el-checkbox :model-value="selectedIds.includes(item.id)" @change="handleSelect(item.id, $event)" /></td>
              <td class="col-name">
                <div class="name-cell"><span class="instance-name" @click.stop="handleViewDetail(item)">{{ item.asset_name || item.asset_id }}</span></div>
              </td>
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.attributes?.status)"></span>
                  <span class="status-text">{{ getStatusText(item.attributes?.status) }}</span>
                </template>
                <template v-else-if="col.key === 'version'"><span>MongoDB {{ item.attributes?.engine_version || '-' }}</span></template>
                <template v-else-if="col.key === 'db_type'"><span>{{ item.attributes?.db_instance_type || item.attributes?.replication_factor ? '副本集' : '单节点' }}</span></template>
                <template v-else-if="col.key === 'instance_type'"><span>{{ item.attributes?.instance_type || item.attributes?.db_instance_class || '-' }}</span></template>
                <template v-else-if="col.key === 'storage'"><span>{{ item.attributes?.storage_size || item.attributes?.db_instance_storage || '-' }} GB</span></template>
                <template v-else-if="col.key === 'connection'"><span class="text-ellipsis">{{ item.attributes?.replica_set_name || item.attributes?.connection_string || '-' }}</span></template>
                <template v-else-if="col.key === 'vpc'"><span class="text-ellipsis">{{ item.attributes?.vpc_id || '-' }}</span></template>
                <template v-else-if="col.key === 'platform'"><IconFont :type="getPlatformIcon(item.attributes?.provider)" class="platform-icon" /></template>
                <template v-else-if="col.key === 'region'"><span>{{ item.attributes?.region || '-' }}</span></template>
                <template v-else-if="col.key === 'charge_type'"><span>{{ getChargeTypeText(item.attributes?.charge_type) }}</span></template>
                <template v-else-if="col.key === 'create_time'"><span>{{ formatDateTime(item.attributes?.creation_time) || formatTime(item.create_time) }}</span></template>
                <template v-else><span>-</span></template>
              </td>
              <td class="col-actions" @click.stop>
                <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, item)">
                  <span class="action-link">更多</span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="view">查看详情</el-dropdown-item>
                      <el-dropdown-item command="console">控制台</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="!loading && instances.length === 0" class="empty-state"><el-icon :size="48"><Box /></el-icon><p>暂无数据</p></div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <div class="pagination-left"><el-checkbox v-model="selectAll" @change="handleSelectAll">全选</el-checkbox><span class="select-info">已选 {{ selectedIds.length }} 项</span></div>
      <div class="pagination-right">
        <el-pagination :current-page="pagination.page" :page-size="pagination.size" :page-sizes="[20, 50, 100]" :total="pagination.total" layout="total, sizes, prev, pager, next, jumper" @size-change="handleSizeChange" @current-change="handleCurrentChange" />
      </div>
    </div>

    <MongodbDetailDrawer v-model:visible="detailDrawerVisible" :instance="detailInstance" />
    <ExportDialog v-model:visible="exportDialogVisible" :instances="instances" :selected-ids="selectedIds" :total="pagination.total" />
    <ColumnSettingsDialog v-model:visible="columnSettingsVisible" :columns="columnSettings" @update:columns="handleColumnSettingsChange" />
  </div>
</template>

<script setup lang="ts">
import { listMongoDBAssetsApi } from '@/api/asset'
import type { Asset } from '@/api/types/asset'
import IconFont from '@/components/IconFont/index.vue'
import { Box, Download, Refresh, Search, Setting } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref } from 'vue'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
import MongodbDetailDrawer from './components/MongodbDetailDrawer.vue'

const loading = ref(false)
const instances = ref<Asset[]>([])
const selectedIds = ref<number[]>([])
const selectAll = ref(false)
const detailDrawerVisible = ref(false)
const detailInstance = ref<Asset | null>(null)
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

const filters = reactive({ keyword: '', provider: '', status: '', region: '' })
const pagination = reactive({ page: 1, size: 20, total: 0 })

const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 90, visible: true },
  { key: 'version', label: '版本', width: 120, visible: true },
  { key: 'db_type', label: '类型', width: 80, visible: true },
  { key: 'instance_type', label: '规格', width: 140, visible: true },
  { key: 'storage', label: '存储', width: 80, visible: true },
  { key: 'connection', label: '副本集', width: 180, visible: true },
  { key: 'platform', label: '平台', width: 50, visible: true },
  { key: 'region', label: '区域', width: 100, visible: true },
  { key: 'vpc', label: 'VPC', width: 150, visible: false },
  { key: 'charge_type', label: '计费方式', width: 90, visible: false },
  { key: 'create_time', label: '创建时间', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

const runningCount = computed(() => instances.value.filter(i => i.attributes?.status?.toLowerCase() === 'running').length)
const stoppedCount = computed(() => instances.value.filter(i => ['stopped', 'shutdown'].includes(i.attributes?.status?.toLowerCase() || '')).length)

const initColumnSettings = () => {
  const saved = localStorage.getItem('mongodb-column-settings')
  if (saved) { try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) { columnSettings.value = parsed; return } } catch { /* ignore */ } }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnSettingsChange = (columns: ColumnConfig[]) => { columnSettings.value = columns }

const fetchInstances = async () => {
  loading.value = true
  try {
    const res = await listMongoDBAssetsApi({ offset: (pagination.page - 1) * pagination.size, limit: pagination.size, provider: filters.provider as any || undefined, status: filters.status || undefined, name: filters.keyword || undefined })
    const data = res.data as any
    instances.value = data?.items || data?.data || []
    pagination.total = data?.total || 0
  } catch (error) { console.error('获取MongoDB列表失败:', error) } finally { loading.value = false }
}

const handleSearch = () => { pagination.page = 1; fetchInstances() }
const handleRefresh = () => fetchInstances()
const handleSizeChange = (size: number) => { pagination.size = size; pagination.page = 1; fetchInstances() }
const handleCurrentChange = (page: number) => { pagination.page = page; fetchInstances() }
const handleSelectAll = (val: boolean | string | number) => { selectedIds.value = val ? instances.value.map(i => i.id) : [] }
const handleSelect = (id: number, val: boolean | string | number) => { if (val) { selectedIds.value.push(id) } else { selectedIds.value = selectedIds.value.filter(i => i !== id) }; selectAll.value = selectedIds.value.length === instances.value.length }
const handleRowClick = (item: Asset) => { handleViewDetail(item) }
const handleViewDetail = (item: Asset) => { detailInstance.value = item; detailDrawerVisible.value = true }
const handleAction = (cmd: string, item: Asset) => { if (cmd === 'view') handleViewDetail(item) }

const getStatusClass = (status?: string) => { if (!status) return ''; const s = status.toLowerCase(); if (s === 'running') return 'running'; if (['stopped', 'shutdown'].includes(s)) return 'stopped'; return 'pending' }
const getStatusText = (status?: string) => { if (!status) return '-'; const map: Record<string, string> = { running: '运行中', stopped: '已停止', shutdown: '已停止', creating: '创建中' }; return map[status.toLowerCase()] || status }
const getPlatformIcon = (provider?: string) => { if (!provider) return 'Alibaba_Cloud'; const p = provider.toLowerCase(); if (p.includes('aliyun') || p.includes('alibaba')) return 'Alibaba_Cloud'; if (p.includes('tencent')) return 'Tencent_Cloud'; if (p.includes('huawei')) return 'Huawei_Cloud'; if (p.includes('aws')) return 'AWS'; if (p.includes('volcano')) return 'Bytecloud'; return 'Alibaba_Cloud' }
const getChargeTypeText = (chargeType?: string) => { if (!chargeType) return '-'; const map: Record<string, string> = { PrePaid: '包年包月', PostPaid: '按量付费' }; return map[chargeType] || chargeType }
const formatDateTime = (dateStr?: string) => { if (!dateStr) return '-'; try { return new Date(dateStr).toLocaleString('zh-CN') } catch { return dateStr } }
const formatTime = (time?: number) => { if (!time) return '-'; return new Date(time).toLocaleString('zh-CN') }

onMounted(() => { initColumnSettings(); fetchInstances() })
</script>

<style lang="scss" scoped>
@import '@/views/storage/styles/storage.scss';
</style>
