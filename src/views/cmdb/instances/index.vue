<template>
  <div class="vm-page">
    <!-- 页面头部 -->
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">{{ pageTitle }}</h1>
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
            <span class="stat-label">关机</span>
            <span class="stat-num">{{ stoppedCount }}</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">监控异常</span>
            <span class="stat-num orange">0</span>
          </div>
          <div class="stat-badge">
            <span class="stat-label">异常</span>
            <span class="stat-num red">0</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <div class="action-left">
        <el-button type="primary" size="small" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新建
        </el-button>
        <el-button size="small" :disabled="!selectedIds.length">开机</el-button>
        <el-button size="small" :disabled="!selectedIds.length">关机</el-button>
        <el-button size="small" :disabled="!selectedIds.length">重启</el-button>
        <el-dropdown trigger="click" :disabled="!selectedIds.length">
          <el-button size="small" :disabled="!selectedIds.length">
            更多状态 <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>挂起</el-dropdown-item>
              <el-dropdown-item>恢复</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown trigger="click" :disabled="!selectedIds.length">
          <el-button size="small" :disabled="!selectedIds.length">
            批量操作 <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>批量删除</el-dropdown-item>
              <el-dropdown-item>批量编辑</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small">
          <el-icon><PriceTag /></el-icon>
          标签
        </el-button>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ instances.length }}条 / 选中{{ selectedIds.length }}条 / 共{{ pagination.total }}条</span>
        <el-button size="small" circle @click="handleRefresh">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button size="small" circle>
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button size="small" circle>
          <el-icon><Setting /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrap">
        <el-icon class="search-icon"><Search /></el-icon>
        <input
          v-model="filters.keyword"
          type="text"
          class="search-input"
          placeholder="默认为名称搜索，自动匹配IP地址搜索，IP地址支持多个搜索用空格/换行/逗号分隔"
          @input="handleSearchInput"
        />
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-container" v-loading="loading">
      <table class="data-table">
        <thead>
          <tr>
            <th class="col-checkbox">
              <el-checkbox v-model="selectAll" @change="handleSelectAll" />
            </th>
            <th class="col-name">名称</th>
            <th class="col-status">状态</th>
            <th class="col-ip">IP</th>
            <th class="col-os">系统</th>
            <th class="col-spec">规格</th>
            <th class="col-env">安全组</th>
            <th class="col-billing">计费方式</th>
            <th class="col-platform">平台</th>
            <th class="col-project">项目</th>
            <th class="col-region">区域</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="item in instances" 
            :key="item.id"
            :class="{ selected: selectedIds.includes(item.id) }"
            @click="handleRowClick(item)"
          >
            <td class="col-checkbox" @click.stop>
              <el-checkbox 
                :model-value="selectedIds.includes(item.id)" 
                @change="handleSelect(item.id, $event)" 
              />
            </td>
            <td class="col-name">
              <div class="name-cell">
                <span class="instance-name" @click.stop="handleViewDetail(item)">
                  {{ item.asset_name || item.asset_id }}
                </span>
                <el-icon v-if="item.attributes?.is_locked" class="lock-icon"><Lock /></el-icon>
              </div>
            </td>
            <td class="col-status">
              <span class="status-dot" :class="getStatusClass(item.attributes?.status)"></span>
              <span class="status-text">{{ getStatusText(item.attributes?.status) }}</span>
            </td>
            <td class="col-ip">
              <span class="ip-text">{{ item.attributes?.private_ip || '-' }}</span>
              <span v-if="item.attributes?.private_ip" class="ip-tag">私有</span>
            </td>
            <td class="col-os">
              <el-icon class="os-icon" :class="getOsClass(item.attributes?.os_type)">
                <component :is="getOsIcon(item.attributes?.os_type)" />
              </el-icon>
            </td>
            <td class="col-spec">
              <span class="spec-text">{{ item.attributes?.instance_type || '-' }}</span>
            </td>
            <td class="col-env">
              <span class="env-tag">{{ item.attributes?.security_group || '-' }}</span>
            </td>
            <td class="col-billing">
              <span class="billing-text">{{ item.attributes?.charge_type || '包年包月' }}</span>
            </td>
            <td class="col-platform">
              <div class="platform-cell">
                <img :src="getPlatformIcon(item.attributes?.provider)" class="platform-icon" />
                <span class="platform-text">{{ item.attributes?.provider || '-' }}</span>
              </div>
            </td>
            <td class="col-project">
              <span class="project-text">{{ item.attributes?.project || item.tenant_id }}</span>
            </td>
            <td class="col-region">
              <div class="region-cell">
                <span class="region-text">{{ item.attributes?.region || '-' }}</span>
                <span v-if="item.attributes?.zone" class="zone-text">{{ item.attributes?.zone }}</span>
              </div>
            </td>
            <td class="col-actions" @click.stop>
              <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, item)">
                <span class="action-link">远程登录</span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="ssh">SSH登录</el-dropdown-item>
                    <el-dropdown-item command="vnc">VNC登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, item)">
                <span class="action-link">更多</span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="view">查看详情</el-dropdown-item>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <span class="danger-text">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 空状态 -->
      <div v-if="!loading && instances.length === 0" class="empty-state">
        <el-icon :size="48"><Box /></el-icon>
        <p>暂无数据</p>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <div class="pagination-left">
        <el-checkbox v-model="selectAll" @change="handleSelectAll">全选</el-checkbox>
        <span class="select-info">已选 {{ selectedIds.length }} 项</span>
      </div>
      <div class="pagination-right">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :page-sizes="[20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
        <span class="resource-info">配置: CPU: 0核/总, 内存: 0G/T, 存储: 0G/T</span>
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="640px"
      :close-on-click-modal="false"
      @closed="handleDialogClosed"
    >
      <InstanceForm ref="formRef" :instance="currentInstance" :is-edit="isEdit" :models="modelOptions" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 实例详情抽屉 -->
    <InstanceDetailDrawer
      v-model:visible="detailDrawerVisible"
      :instance="detailInstance"
      @edit="handleEdit"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { deleteCmdbInstanceApi, listCmdbInstancesApi, listCmdbModelsApi } from '@/api'
import type { InstanceVO, ModelVO } from '@/api/types/cmdb'
import {
  ArrowDown,
  Box,
  Download,
  Lock,
  Monitor,
  Plus,
  PriceTag,
  Refresh,
  Search,
  Setting
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import InstanceDetailDrawer from './components/InstanceDetailDrawer.vue'
import InstanceForm from './components/InstanceForm.vue'

const route = useRoute()

// 状态
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const currentInstance = ref<InstanceVO | null>(null)
const selectedIds = ref<number[]>([])
const selectAll = ref(false)

// 数据
const instances = ref<InstanceVO[]>([])
const modelOptions = ref<ModelVO[]>([])

const filters = reactive({
  keyword: '',
  uid: '',
  status: '',
  region: '',
})

const searchTimer = ref<number | null>(null)

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

// 计算属性
const pageTitle = computed(() => {
  if (filters.uid) {
    const model = modelOptions.value.find(m => m.uid === filters.uid)
    return model?.name || '虚拟机'
  }
  return '虚拟机'
})

const dialogTitle = computed(() => (isEdit.value ? '编辑实例' : '创建实例'))
const runningCount = computed(() => instances.value.filter(i => i.attributes?.status === 'Running').length)
const stoppedCount = computed(() => instances.value.filter(i => i.attributes?.status === 'Stopped').length)

// 辅助函数
const getStatusClass = (status: string | undefined) => {
  const map: Record<string, string> = {
    Running: 'running',
    Stopped: 'stopped',
    Deleted: 'error',
    Pending: 'pending',
  }
  return map[status || ''] || ''
}

const getStatusText = (status: string | undefined) => {
  const map: Record<string, string> = {
    Running: '运行中',
    Stopped: '已关机',
    Deleted: '已删除',
    Pending: '创建中',
  }
  return map[status || ''] || status || '-'
}

const getOsClass = (osType: string | undefined) => {
  if (!osType) return ''
  if (osType.toLowerCase().includes('windows')) return 'windows'
  return 'linux'
}

const getOsIcon = (_osType: string | undefined) => {
  return Monitor
}

const getPlatformIcon = (provider: string | undefined) => {
  const map: Record<string, string> = {
    aliyun: 'https://img.alicdn.com/tfs/TB1_ZXuNcfpK1RjSZFOXXa6nFXa-32-32.ico',
    aws: 'https://a0.awsstatic.com/libra-css/images/site/fav/favicon.ico',
    huawei: 'https://www.huaweicloud.com/favicon.ico',
  }
  return map[provider || ''] || ''
}

// 选择相关
const handleSelectAll = (val: boolean | string | number) => {
  if (val) {
    selectedIds.value = instances.value.map(i => i.id)
  } else {
    selectedIds.value = []
  }
}

const handleSelect = (id: number, checked: boolean | string | number) => {
  if (checked) {
    selectedIds.value.push(id)
  } else {
    selectedIds.value = selectedIds.value.filter(i => i !== id)
  }
  selectAll.value = selectedIds.value.length === instances.value.length
}

const handleRowClick = (item: InstanceVO) => {
  const idx = selectedIds.value.indexOf(item.id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(item.id)
  }
  selectAll.value = selectedIds.value.length === instances.value.length
}

// 获取模型列表
const fetchModels = async () => {
  try {
    const response = await listCmdbModelsApi({ limit: 100 })
    const responseData = response.data as any
    if (responseData?.data?.models) {
      modelOptions.value = responseData.data.models
    } else if (responseData?.models) {
      modelOptions.value = responseData.models
    }
  } catch (error) {
    console.error('获取模型列表失败:', error)
  }
}

// 获取实例列表
const fetchInstances = async () => {
  loading.value = true
  selectedIds.value = []
  selectAll.value = false
  try {
    const params = {
      uid: filters.uid || undefined,
      asset_name: filters.keyword || undefined,
      status: filters.status || undefined,
      region: filters.region || undefined,
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }

    const response = await listCmdbInstancesApi(params)
    const responseData = response.data as any

    if (responseData?.data) {
      instances.value = responseData.data.instances || []
      pagination.total = responseData.data.total || 0
    } else if (responseData?.instances) {
      instances.value = responseData.instances
      pagination.total = responseData.total || 0
    } else {
      instances.value = []
      pagination.total = 0
    }
  } catch (error: any) {
    console.error('获取实例列表失败:', error)
    ElMessage.error('获取实例列表失败')
    instances.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 刷新
const handleRefresh = () => {
  fetchInstances()
}

// 搜索输入处理（防抖）
const handleSearchInput = () => {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = window.setTimeout(() => {
    pagination.page = 1
    fetchInstances()
  }, 500)
}

// 分页
const handleSizeChange = () => {
  pagination.page = 1
  fetchInstances()
}

const handleCurrentChange = () => {
  fetchInstances()
}

// 添加实例
const handleAdd = () => {
  isEdit.value = false
  currentInstance.value = null
  dialogVisible.value = true
}

// 编辑实例
const handleEdit = (instance: InstanceVO) => {
  isEdit.value = true
  currentInstance.value = instance
  dialogVisible.value = true
}

// 详情抽屉
const detailDrawerVisible = ref(false)
const detailInstance = ref<InstanceVO | null>(null)

const handleViewDetail = (instance: InstanceVO) => {
  detailInstance.value = instance
  detailDrawerVisible.value = true
}

// 操作处理
const handleAction = (command: string, instance: InstanceVO) => {
  switch (command) {
    case 'view':
      handleViewDetail(instance)
      break
    case 'edit':
      handleEdit(instance)
      break
    case 'delete':
      handleDelete(instance)
      break
  }
}

// 删除实例
const handleDelete = async (instance: InstanceVO) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除实例"${instance.asset_name || instance.asset_id}"吗？`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteCmdbInstanceApi(instance.id)
    ElMessage.success('删除成功')
    detailDrawerVisible.value = false
    fetchInstances()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    submitting.value = true
    await formRef.value.submit()
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    fetchInstances()
  } catch (error: any) {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDialogClosed = () => {
  currentInstance.value = null
  if (formRef.value) formRef.value.reset()
}

onMounted(() => {
  if (route.params.uid) {
    filters.uid = route.params.uid as string
  } else if (route.query.uid) {
    filters.uid = route.query.uid as string
  }
  fetchModels()
  fetchInstances()
})

watch(
  () => route.params.uid,
  (newUid) => {
    if (newUid) {
      filters.uid = newUid as string
      pagination.page = 1
      fetchInstances()
    }
  }
)
</script>

<style scoped lang="scss">
.vm-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
  margin: -24px;  // 抵消外层 padding
  height: calc(100% + 48px);
}

// 页面顶部
.page-top {
  padding: 16px 20px 12px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.page-title-row {
  display: flex;
  align-items: center;
  gap: 24px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.tab-nav {
  display: flex;
  gap: 4px;

  .tab-item {
    padding: 6px 16px;
    font-size: 14px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms ease;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }

    &.active {
      color: var(--accent-blue);
      background: rgba(59, 130, 246, 0.1);
    }
  }
}

.stats-badges {
  display: flex;
  gap: 16px;
  margin-left: auto;
}

.stat-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  min-width: 60px;

  .stat-label {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .stat-num {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;

    &.blue { color: var(--accent-blue); }
    &.orange { color: var(--accent-yellow); }
    &.red { color: var(--accent-red); }
  }
}

// 操作栏
.action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.action-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-right {
  display: flex;
  align-items: center;
  gap: 12px;

  .page-info {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

// 搜索栏
.search-bar {
  padding: 12px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-subtle);
}

.search-input-wrap {
  position: relative;
  max-width: 600px;

  .search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
  }

  .search-input {
    width: 100%;
    height: 36px;
    padding: 0 12px 0 36px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: all 200ms ease;

    &::placeholder {
      color: var(--text-muted);
    }

    &:focus {
      border-color: var(--accent-blue);
    }
  }
}

// 表格容器
.table-container {
  flex: 1;
  overflow: auto;
  background: var(--bg-elevated);
  position: relative;
  min-height: 0;

  // 确保表格填满容器
  .data-table {
    min-height: 100%;
  }
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  thead {
    position: sticky;
    top: 0;
    z-index: 10;
    
    th {
      background: var(--bg-surface);
    }
  }

  th, td {
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-subtle);
    white-space: nowrap;
  }

  th {
    color: var(--text-secondary);
    font-weight: 500;
  }

  tbody tr {
    transition: background 150ms ease;
    cursor: pointer;

    &:hover {
      background: var(--bg-hover);
    }

    &.selected {
      background: rgba(59, 130, 246, 0.08);
    }
  }
}

.col-checkbox { width: 40px; }
.col-name { min-width: 180px; }
.col-status { width: 90px; }
.col-ip { width: 140px; }
.col-os { width: 50px; }
.col-spec { width: 120px; }
.col-env { width: 100px; }
.col-billing { width: 80px; }
.col-platform { width: 100px; }
.col-project { width: 100px; }
.col-region { width: 140px; }
.col-actions { width: 120px; }

// 单元格样式
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;

  .instance-name {
    color: var(--accent-blue);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  .lock-icon {
    color: var(--text-muted);
    font-size: 12px;
  }
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 6px;
  background: var(--text-muted);

  &.running { background: var(--accent-green); }
  &.stopped { background: var(--text-tertiary); }
  &.error { background: var(--accent-red); }
  &.pending { background: var(--accent-yellow); }
}

.status-text {
  color: var(--text-secondary);
}

.ip-text {
  color: var(--text-primary);
}

.ip-tag {
  margin-left: 4px;
  padding: 1px 4px;
  font-size: 10px;
  background: var(--bg-hover);
  border-radius: 2px;
  color: var(--text-tertiary);
}

.os-icon {
  font-size: 18px;
  color: var(--text-tertiary);

  &.windows { color: #0078d4; }
  &.linux { color: #f0c674; }
}

.spec-text, .billing-text, .project-text {
  color: var(--text-secondary);
}

.env-tag {
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.platform-cell {
  display: flex;
  align-items: center;
  gap: 6px;

  .platform-icon {
    width: 16px;
    height: 16px;
  }

  .platform-text {
    color: var(--text-secondary);
  }
}

.region-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .region-text {
    color: var(--text-secondary);
  }

  .zone-text {
    font-size: 11px;
    color: var(--text-muted);
  }
}

.action-link {
  color: var(--accent-blue);
  cursor: pointer;
  margin-right: 12px;

  &:hover {
    text-decoration: underline;
  }
}

.danger-text {
  color: var(--accent-red);
}

// 空状态
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);

  p {
    margin-top: 12px;
  }
}

// 分页栏
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.pagination-left {
  display: flex;
  align-items: center;
  gap: 12px;

  .select-info {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

.pagination-right {
  display: flex;
  align-items: center;
  gap: 16px;

  .resource-info {
    font-size: 12px;
    color: var(--text-muted);
  }
}
</style>
