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
        <el-popover
          v-model:visible="tagFilterVisible"
          placement="bottom-start"
          :width="280"
          popper-class="tag-filter-popover"
        >
          <template #reference>
            <el-button size="small" :class="{ 'is-active': hasTagFilter }">
              <el-icon><PriceTag /></el-icon>
              标签
              <span v-if="hasTagFilter" class="filter-count">1</span>
              <el-icon><ArrowDown /></el-icon>
            </el-button>
          </template>
          <div class="tag-filter-panel">
            <div class="tag-filter-options">
              <div 
                class="tag-option" 
                :class="{ active: filters.has_tags === 'false' }"
                @click="applyTagFilter('no-tags')"
              >
                无标签资源
              </div>
              <div 
                class="tag-option" 
                :class="{ active: filters.has_tags === 'true' && !filters.tag_key }"
                @click="applyTagFilter('has-tags')"
              >
                有标签资源
                <el-icon v-if="filters.has_tags === 'true' && !filters.tag_key"><Check /></el-icon>
              </div>
            </div>
            <div class="tag-filter-search">
              <el-input
                v-model="tagKeySearch"
                placeholder="输入标签键搜索或自定义"
                size="small"
                clearable
                :prefix-icon="Search"
                @keyup.enter="applyCustomTagKey"
              />
              <div v-if="tagKeySearch && !filteredTagKeys.includes(tagKeySearch)" class="custom-tag-hint">
                按回车使用 "{{ tagKeySearch }}" 筛选
              </div>
            </div>
            <div class="tag-key-list">
              <div 
                v-for="key in filteredTagKeys" 
                :key="key"
                class="tag-key-item"
                :class="{ active: filters.tag_key === key }"
                @click="selectTagKey(key)"
              >
                {{ key }}
                <el-icon v-if="filters.tag_key === key"><Check /></el-icon>
              </div>
              <div v-if="filteredTagKeys.length === 0" class="tag-key-empty">
                暂无标签
              </div>
            </div>
            <div v-if="filters.tag_key" class="tag-value-input">
              <el-input
                v-model="filters.tag_value"
                :placeholder="`输入 ${filters.tag_key} 的值`"
                size="small"
                clearable
                @change="handleFilterChange"
              />
            </div>
            <div class="tag-filter-footer">
              <el-button size="small" text @click="clearTagFilter">清除</el-button>
              <el-button size="small" type="primary" @click="tagFilterVisible = false">确定</el-button>
            </div>
          </div>
        </el-popover>
      </div>
      <div class="action-right">
        <span class="page-info">本页{{ instances.length }}条 / 选中{{ selectedIds.length }}条 / 共{{ pagination.total }}条</span>
        <el-button size="small" circle @click="handleRefresh" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button size="small" circle @click="exportDialogVisible = true" title="导出">
          <el-icon><Download /></el-icon>
        </el-button>
        <el-button size="small" circle @click="columnSettingsVisible = true" title="自定义列">
          <el-icon><Setting /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-row">
        <div class="search-input-wrap">
          <el-popover
            v-model:visible="searchFilterVisible"
            placement="bottom-start"
            :width="currentSearchField && searchFieldOptions[currentSearchField] ? 280 : 200"
            popper-class="search-filter-popover"
          >
            <template #reference>
              <div class="search-box">
                <el-icon class="search-icon"><Search /></el-icon>
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="search-input"
                  placeholder="输入搜索内容，回车添加条件"
                  @focus="handleSearchFocus"
                  @keyup.enter="handleSearchEnter"
                />
              </div>
            </template>
            <!-- 属性选择面板 -->
            <div v-if="!currentSearchField" class="search-filter-panel">
              <div class="search-filter-title">选择搜索属性</div>
              <div class="search-filter-list">
                <div 
                  v-for="field in searchFields" 
                  :key="field.key" 
                  class="search-filter-item"
                  @click="selectSearchFilter(field.key)"
                >
                  <span>{{ field.label }}</span>
                  <el-icon v-if="field.hasOptions"><ArrowRight /></el-icon>
                </div>
              </div>
            </div>
            <!-- 属性值选择面板 -->
            <div v-else class="search-value-panel">
              <div class="search-value-header">
                <el-icon class="back-icon" @click="currentSearchField = ''"><ArrowLeft /></el-icon>
                <span>{{ searchFieldLabels[currentSearchField] }}</span>
              </div>
              <!-- 有固定选项的属性 -->
              <template v-if="searchFieldOptions[currentSearchField]">
                <div class="search-value-list">
                  <div 
                    v-for="opt in searchFieldOptions[currentSearchField]" 
                    :key="opt.value"
                    class="search-value-item"
                    @click="selectSearchValue(opt)"
                  >
                    {{ opt.label }}
                  </div>
                </div>
              </template>
              <!-- 需要输入的属性 -->
              <template v-else>
                <div class="search-value-input">
                  <el-input
                    v-model="searchKeyword"
                    :placeholder="`输入${searchFieldLabels[currentSearchField]}`"
                    size="small"
                    @keyup.enter="handleSearchEnter"
                  />
                  <el-button size="small" type="primary" @click="handleSearchEnter">确定</el-button>
                </div>
              </template>
            </div>
          </el-popover>
        </div>
        
        <!-- 已添加的搜索条件标签 -->
        <div class="search-tags" v-if="searchConditions.length > 0">
          <el-tag
            v-for="(cond, idx) in searchConditions"
            :key="idx"
            closable
            size="small"
            @close="removeSearchCondition(idx)"
          >
            {{ searchFieldLabels[cond.field] }}: {{ cond.displayValue }}
          </el-tag>
          <span class="clear-search-btn" @click="clearAllSearchConditions">清除</span>
        </div>
      </div>
    </div>

    <!-- 表格区域 -->
    <div class="table-wrapper">
      <!-- 固定表头 -->
      <div class="table-header">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-checkbox">
                <el-checkbox v-model="selectAll" @change="handleSelectAll" />
              </th>
              <th class="col-name">名称</th>
              <th v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                {{ col.label }}
              </th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
        </table>
      </div>

      <!-- 表格内容（可滚动） -->
      <div class="table-body" v-loading="loading">
        <table class="data-table">
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
              <!-- 动态列 -->
              <td v-for="col in visibleColumns" :key="col.key" :style="{ width: col.width + 'px' }">
                <!-- 状态列 -->
                <template v-if="col.key === 'status'">
                  <span class="status-dot" :class="getStatusClass(item.attributes?.status)"></span>
                  <span class="status-text">{{ getStatusText(item.attributes?.status) }}</span>
                </template>
                <!-- IP列 -->
                <template v-else-if="col.key === 'ip'">
                  <span class="ip-text">{{ item.attributes?.private_ip || '-' }}</span>
                  <span v-if="item.attributes?.private_ip" class="ip-tag">私有</span>
                </template>
                <!-- 公网IP列 -->
                <template v-else-if="col.key === 'public_ip'">
                  <span class="ip-text">{{ item.attributes?.public_ip || '-' }}</span>
                  <span v-if="item.attributes?.public_ip" class="ip-tag">公网</span>
                </template>
                <!-- 系统列 -->
                <template v-else-if="col.key === 'os'">
                  <IconFont :type="getOsIcon(item.attributes?.os_type)" class="os-icon" :title="item.attributes?.os_name" />
                </template>
                <!-- 规格列 -->
                <template v-else-if="col.key === 'spec'">
                  <span class="spec-text">{{ item.attributes?.instance_type || '-' }}</span>
                </template>
                <!-- 安全组列 -->
                <template v-else-if="col.key === 'security_group'">
                  <span class="env-tag">{{ getSecurityGroupCount(item) }}</span>
                </template>
                <!-- 计费方式列 -->
                <template v-else-if="col.key === 'billing'">
                  <span class="billing-text">{{ getChargeTypeText(item.attributes?.charge_type) }}</span>
                </template>
                <!-- 平台列 -->
                <template v-else-if="col.key === 'platform'">
                  <IconFont :type="getPlatformIcon(item.attributes?.platform || item.attributes?.provider)" class="platform-icon" :title="getProviderName(item.attributes?.provider)" />
                </template>
                <!-- 项目列 -->
                <template v-else-if="col.key === 'project'">
                  <span class="project-text">{{ item.attributes?.project || item.tenant_id }}</span>
                </template>
                <!-- 区域列 -->
                <template v-else-if="col.key === 'region'">
                  <div class="region-cell">
                    <span class="region-text">{{ item.attributes?.region || '-' }}</span>
                  </div>
                </template>
                <!-- 主机名列 -->
                <template v-else-if="col.key === 'host_name'">
                  <span class="text-ellipsis">{{ item.attributes?.host_name || '-' }}</span>
                </template>
                <!-- CPU列 -->
                <template v-else-if="col.key === 'cpu'">
                  <span>{{ item.attributes?.cpu ? item.attributes.cpu + '核' : '-' }}</span>
                </template>
                <!-- 内存列 -->
                <template v-else-if="col.key === 'memory'">
                  <span>{{ formatMemory(item.attributes?.memory) }}</span>
                </template>
                <!-- 云账号列 -->
                <template v-else-if="col.key === 'cloud_account'">
                  <span class="text-ellipsis">{{ item.attributes?.cloud_account_name || '-' }}</span>
                </template>
                <!-- VPC列 -->
                <template v-else-if="col.key === 'vpc'">
                  <span class="text-ellipsis">{{ item.attributes?.vpc_id || '-' }}</span>
                </template>
                <!-- 可用区列 -->
                <template v-else-if="col.key === 'zone'">
                  <span>{{ item.attributes?.zone || '-' }}</span>
                </template>
                <!-- 到期时间列 -->
                <template v-else-if="col.key === 'expired_time'">
                  <span>{{ formatDateTime(item.attributes?.expired_time) }}</span>
                </template>
                <!-- 创建时间列 -->
                <template v-else-if="col.key === 'create_time'">
                  <span>{{ formatDateTime(item.attributes?.creation_time) || formatTime(item.create_time) }}</span>
                </template>
                <!-- 标签列 -->
                <template v-else-if="col.key === 'tags'">
                  <span class="tags-cell">{{ formatTags(item.attributes?.tags) }}</span>
                </template>
                <!-- 默认 -->
                <template v-else>
                  <span>-</span>
                </template>
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
    </div>

    <!-- 分页 -->
    <div class="pagination-bar">
      <div class="pagination-left">
        <el-checkbox v-model="selectAll" @change="handleSelectAll">全选</el-checkbox>
        <span class="select-info">已选 {{ selectedIds.length }} 项</span>
      </div>
      <div class="pagination-right">
        <el-pagination
          :current-page="pagination.page"
          :page-size="pagination.size"
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

    <!-- 导出对话框 -->
    <ExportDialog
      v-model:visible="exportDialogVisible"
      :instances="instances"
      :selected-ids="selectedIds"
      :total="pagination.total"
    />

    <!-- 自定义列对话框 -->
    <ColumnSettingsDialog
      v-model:visible="columnSettingsVisible"
      :columns="columnSettings"
      @update:columns="handleColumnSettingsChange"
    />
  </div>
</template>

<script setup lang="ts">
import { deleteCmdbInstanceApi, listCmdbInstancesApi, listCmdbModelsApi } from '@/api'
import type { InstanceVO, ModelVO } from '@/api/types/cmdb'
import IconFont from '@/components/IconFont/index.vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Download,
  Lock,
  Plus,
  PriceTag,
  Refresh,
  Search,
  Setting
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ColumnSettingsDialog, { type ColumnConfig } from './components/ColumnSettingsDialog.vue'
import ExportDialog from './components/ExportDialog.vue'
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

// 导出和列设置对话框
const exportDialogVisible = ref(false)
const columnSettingsVisible = ref(false)

// 数据
const instances = ref<InstanceVO[]>([])
const modelOptions = ref<ModelVO[]>([])

// 列配置
const defaultColumnSettings: ColumnConfig[] = [
  { key: 'status', label: '状态', width: 80, visible: true },
  { key: 'ip', label: 'IP', width: 130, visible: true },
  { key: 'os', label: '系统', width: 40, visible: true },
  { key: 'spec', label: '规格', width: 110, visible: true },
  { key: 'security_group', label: '安全组', width: 90, visible: true },
  { key: 'billing', label: '计费方式', width: 80, visible: true },
  { key: 'platform', label: '平台', width: 50, visible: true },
  { key: 'project', label: '项目', width: 80, visible: true },
  { key: 'region', label: '区域', width: 100, visible: true },
  { key: 'host_name', label: '主机名', width: 150, visible: false },
  { key: 'public_ip', label: '公网IP', width: 120, visible: false },
  { key: 'cpu', label: 'CPU', width: 60, visible: false },
  { key: 'memory', label: '内存', width: 70, visible: false },
  { key: 'cloud_account', label: '云账号', width: 120, visible: false },
  { key: 'vpc', label: 'VPC', width: 150, visible: false },
  { key: 'zone', label: '可用区', width: 100, visible: false },
  { key: 'expired_time', label: '到期时间', width: 140, visible: false },
  { key: 'create_time', label: '创建时间', width: 140, visible: false },
  { key: 'tags', label: '标签', width: 150, visible: false },
]

const columnSettings = ref<ColumnConfig[]>([])
const visibleColumns = computed(() => columnSettings.value.filter(c => c.visible))

// 初始化列配置
const initColumnSettings = () => {
  const saved = localStorage.getItem('vm-column-settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        columnSettings.value = parsed
        return
      }
    } catch (e) {
      console.error('解析列设置失败:', e)
    }
  }
  columnSettings.value = JSON.parse(JSON.stringify(defaultColumnSettings))
}

const handleColumnSettingsChange = (columns: ColumnConfig[]) => {
  columnSettings.value = columns
}

const filters = reactive({
  keyword: '',
  uid: '',
  status: '',
  region: '',
  zone: '',
  provider: '',
  charge_type: '',
  os_type: '',
  instance_type: '',
  vpc_id: '',
  private_ip: '',
  public_ip: '',
  project_id: '',
  has_tags: '' as '' | 'true' | 'false',
  tag_key: '',
  tag_value: '',
})

// 标签筛选
const tagFilterVisible = ref(false)
const tagKeySearch = ref('')

// 搜索筛选
const searchFilterVisible = ref(false)
const currentSearchField = ref('')
const searchKeyword = ref('')

// 搜索条件类型
interface SearchCondition {
  field: string
  value: string
  displayValue: string
}

const searchConditions = ref<SearchCondition[]>([])

// 搜索字段配置
const searchFields = [
  { key: 'asset_name', label: '名称', hasOptions: false },
  { key: 'asset_id', label: '云上ID', hasOptions: false },
  { key: 'private_ip', label: 'IP', hasOptions: false },
  { key: 'host_name', label: '主机名', hasOptions: false },
  { key: 'status', label: '状态', hasOptions: true },
  { key: 'provider', label: '平台', hasOptions: true },
  { key: 'region', label: '区域', hasOptions: false },
  { key: 'instance_type', label: '规格', hasOptions: false },
  { key: 'charge_type', label: '计费方式', hasOptions: true },
  { key: 'vpc_id', label: 'VPC', hasOptions: false },
  { key: 'os_type', label: '系统', hasOptions: true },
]

const searchFieldLabels: Record<string, string> = {
  asset_name: '名称',
  asset_id: '云上ID',
  private_ip: 'IP',
  host_name: '主机名',
  status: '状态',
  provider: '平台',
  region: '区域',
  instance_type: '规格',
  charge_type: '计费方式',
  vpc_id: 'VPC',
  os_type: '系统',
}

// 有固定选项的字段
const searchFieldOptions: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: '运行中', value: 'RUNNING' },
    { label: '已关机', value: 'STOPPED' },
    { label: '创建中', value: 'PENDING' },
  ],
  provider: [
    { label: '阿里云', value: 'aliyun' },
    { label: '腾讯云', value: 'tencent' },
    { label: '华为云', value: 'huawei' },
    { label: 'AWS', value: 'aws' },
    { label: '火山引擎', value: 'volcano' },
  ],
  charge_type: [
    { label: '包年包月', value: 'PrePaid' },
    { label: '按量付费', value: 'PostPaid' },
  ],
  os_type: [
    { label: 'Linux', value: 'Linux' },
    { label: 'Windows', value: 'Windows' },
  ],
}

const handleSearchFocus = () => {
  searchFilterVisible.value = true
}

const selectSearchFilter = (field: string) => {
  currentSearchField.value = field
  searchKeyword.value = ''
  // 如果没有固定选项，聚焦到输入框
  if (!searchFieldOptions[field]) {
    setTimeout(() => {
      const input = document.querySelector('.search-value-input input') as HTMLInputElement
      if (input) input.focus()
    }, 100)
  }
}

const selectSearchValue = (opt: { label: string; value: string }) => {
  // 添加搜索条件
  const existingIdx = searchConditions.value.findIndex(c => c.field === currentSearchField.value)
  if (existingIdx > -1) {
    searchConditions.value[existingIdx] = { field: currentSearchField.value, value: opt.value, displayValue: opt.label }
  } else {
    searchConditions.value.push({ field: currentSearchField.value, value: opt.value, displayValue: opt.label })
  }
  
  // 重置并关闭
  currentSearchField.value = ''
  searchFilterVisible.value = false
  applySearchConditions()
}

const handleSearchEnter = () => {
  const value = searchKeyword.value.trim()
  if (!value) return
  
  // 如果没有选择字段，默认用名称搜索
  const field = currentSearchField.value || 'asset_name'

  // 检查是否已存在相同字段的条件，如果存在则替换
  const existingIdx = searchConditions.value.findIndex(c => c.field === field)
  if (existingIdx > -1) {
    searchConditions.value[existingIdx] = { field, value, displayValue: value }
  } else {
    searchConditions.value.push({ field, value, displayValue: value })
  }

  // 清空输入并重置字段
  searchKeyword.value = ''
  currentSearchField.value = ''
  searchFilterVisible.value = false
  
  // 应用搜索
  applySearchConditions()
}

const removeSearchCondition = (idx: number) => {
  searchConditions.value.splice(idx, 1)
  applySearchConditions()
}

const clearAllSearchConditions = () => {
  searchConditions.value = []
  applySearchConditions()
}

const applySearchConditions = () => {
  // 先清除所有搜索相关的筛选
  filters.keyword = ''
  filters.private_ip = ''
  filters.public_ip = ''
  filters.status = ''
  filters.provider = ''
  filters.region = ''
  filters.instance_type = ''
  filters.charge_type = ''
  filters.vpc_id = ''
  filters.os_type = ''

  // 应用所有搜索条件
  searchConditions.value.forEach(cond => {
    switch (cond.field) {
      case 'asset_name':
      case 'asset_id':
      case 'host_name':
        filters.keyword = cond.value
        break
      case 'private_ip':
        filters.private_ip = cond.value
        break
      case 'status':
        filters.status = cond.value
        break
      case 'provider':
        filters.provider = cond.value
        break
      case 'region':
        filters.region = cond.value
        break
      case 'instance_type':
        filters.instance_type = cond.value
        break
      case 'charge_type':
        filters.charge_type = cond.value
        break
      case 'vpc_id':
        filters.vpc_id = cond.value
        break
      case 'os_type':
        filters.os_type = cond.value
        break
    }
  })

  pagination.page = 1
  fetchInstances()
}

// 从实例数据中动态提取标签键
const availableTagKeys = computed(() => {
  const keysSet = new Set<string>()
  instances.value.forEach(instance => {
    const tags = instance.attributes?.tags
    if (tags && typeof tags === 'object') {
      Object.keys(tags).forEach(key => keysSet.add(key))
    }
  })
  return Array.from(keysSet).sort()
})

const hasTagFilter = computed(() => filters.has_tags !== '' || filters.tag_key !== '')

const filteredTagKeys = computed(() => {
  if (!tagKeySearch.value) return availableTagKeys.value
  const search = tagKeySearch.value.toLowerCase()
  return availableTagKeys.value.filter(key => key.toLowerCase().includes(search))
})

const applyTagFilter = (type: 'no-tags' | 'has-tags') => {
  if (type === 'no-tags') {
    filters.has_tags = 'false'
    filters.tag_key = ''
    filters.tag_value = ''
  } else {
    filters.has_tags = 'true'
    filters.tag_key = ''
    filters.tag_value = ''
  }
  pagination.page = 1
  fetchInstances()
}

const selectTagKey = (key: string) => {
  if (filters.tag_key === key) {
    filters.tag_key = ''
    filters.tag_value = ''
  } else {
    filters.tag_key = key
    filters.has_tags = ''
  }
  pagination.page = 1
  fetchInstances()
}

const applyCustomTagKey = () => {
  if (tagKeySearch.value) {
    filters.tag_key = tagKeySearch.value
    filters.has_tags = ''
    tagKeySearch.value = ''
    pagination.page = 1
    fetchInstances()
  }
}

const clearTagFilter = () => {
  filters.has_tags = ''
  filters.tag_key = ''
  filters.tag_value = ''
  tagFilterVisible.value = false
  pagination.page = 1
  fetchInstances()
}

const handleFilterChange = () => {
  pagination.page = 1
  fetchInstances()
}

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
const runningCount = computed(() => instances.value.filter(i => {
  const status = i.attributes?.status?.toUpperCase()
  return status === 'RUNNING'
}).length)
const stoppedCount = computed(() => instances.value.filter(i => {
  const status = i.attributes?.status?.toUpperCase()
  return status === 'STOPPED'
}).length)

// 辅助函数
const getStatusClass = (status: string | undefined) => {
  if (!status) return ''
  const s = status.toUpperCase()
  const map: Record<string, string> = {
    RUNNING: 'running',
    STOPPED: 'stopped',
    DELETED: 'error',
    PENDING: 'pending',
  }
  return map[s] || ''
}

const getStatusText = (status: string | undefined) => {
  if (!status) return '-'
  const s = status.toUpperCase()
  const map: Record<string, string> = {
    RUNNING: '运行中',
    STOPPED: '已关机',
    DELETED: '已删除',
    PENDING: '创建中',
  }
  return map[s] || status
}

const getOsIcon = (osType: string | undefined): string => {
  if (!osType) return 'caise-Linux'
  const os = osType.toLowerCase()
  if (os.includes('windows')) return 'caise-Windows'
  if (os.includes('ubuntu')) return 'caise-Ubuntu'
  if (os.includes('centos')) return 'caise-centos'
  // 默认返回 Linux 图标（适用于 Rocky Linux、Debian、RedHat 等）
  return 'caise-Linux'
}

const getPlatformIcon = (provider: string | undefined): string => {
  if (!provider) return 'Alibaba_Cloud'
  const p = provider.toLowerCase()
  // 映射到 IconFont 彩色图标
  if (p.includes('aliyun') || p.includes('alibaba')) return 'Alibaba_Cloud'
  if (p.includes('tencent') || p.includes('qcloud')) return 'Tencent_Cloud'
  if (p.includes('huawei')) return 'Huawei_Cloud'
  if (p.includes('aws') || p.includes('amazon')) return 'AWS'
  if (p.includes('azure') || p.includes('microsoft')) return 'Azure'
  if (p.includes('google') || p.includes('gcp')) return 'Google_Cloud_Platform'
  if (p.includes('volcengine') || p.includes('volc') || p.includes('bytedance')) return 'Bytecloud'
  if (p.includes('ucloud')) return 'UCloud'
  if (p.includes('jd') || p.includes('jdcloud')) return 'JDCloud'
  if (p.includes('ecloud') || p.includes('ctyun')) return 'Ctyun'
  if (p.includes('openstack')) return 'OpenStack'
  if (p.includes('vmware') || p.includes('vsphere')) return 'caise-vmware'
  if (p.includes('nutanix')) return 'Nutanix'
  if (p.includes('zstack')) return 'ZStack'
  return 'Alibaba_Cloud'
}

const getChargeTypeText = (chargeType: string | undefined) => {
  const map: Record<string, string> = {
    PrePaid: '包年包月',
    PostPaid: '按量付费',
    prepaid: '包年包月',
    postpaid: '按量付费',
  }
  return map[chargeType || ''] || chargeType || '包年包月'
}

const getProviderName = (provider: string | undefined): string => {
  if (!provider) return '-'
  const p = provider.toLowerCase()
  if (p.includes('aliyun') || p.includes('alibaba')) return '阿里云'
  if (p.includes('tencent') || p.includes('qcloud')) return '腾讯云'
  if (p.includes('huawei')) return '华为云'
  if (p.includes('aws') || p.includes('amazon')) return 'AWS'
  if (p.includes('azure') || p.includes('microsoft')) return 'Azure'
  if (p.includes('google') || p.includes('gcp')) return 'Google Cloud'
  if (p.includes('volcengine') || p.includes('volc') || p.includes('bytedance') || p.includes('volcano')) return '火山引擎'
  if (p.includes('ucloud')) return 'UCloud'
  if (p.includes('jd') || p.includes('jdcloud')) return '京东云'
  if (p.includes('ecloud') || p.includes('ctyun')) return '天翼云'
  return provider
}

const getSecurityGroupCount = (item: InstanceVO): string => {
  const groups = item.attributes?.security_groups || item.attributes?.security_group_ids
  if (Array.isArray(groups) && groups.length > 0) {
    return `${groups.length} 个`
  }
  return item.attributes?.security_group || '-'
}

const formatMemory = (memory: number | undefined): string => {
  if (!memory) return '-'
  if (memory >= 1024) {
    return `${(memory / 1024).toFixed(0)}GB`
  }
  return `${memory}MB`
}

const formatDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

const formatTime = (time: number | undefined): string => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const formatTags = (tags: Record<string, string> | undefined): string => {
  if (!tags || typeof tags !== 'object') return '-'
  const entries = Object.entries(tags)
  if (entries.length === 0) return '-'
  if (entries.length <= 2) {
    return entries.map(([k, v]) => `${k}:${v}`).join(', ')
  }
  return `${entries.slice(0, 2).map(([k, v]) => `${k}:${v}`).join(', ')} +${entries.length - 2}`
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
    const params: Record<string, any> = {
      uid: filters.uid || undefined,
      asset_name: filters.keyword || undefined,
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    
    // 添加筛选条件
    if (filters.status) params.status = filters.status
    if (filters.region) params.region = filters.region
    if (filters.zone) params.zone = filters.zone
    if (filters.provider) params.provider = filters.provider
    if (filters.charge_type) params.charge_type = filters.charge_type
    if (filters.os_type) params.os_type = filters.os_type
    if (filters.instance_type) params.instance_type = filters.instance_type
    if (filters.vpc_id) params.vpc_id = filters.vpc_id
    if (filters.private_ip) params.private_ip = filters.private_ip
    if (filters.public_ip) params.public_ip = filters.public_ip
    if (filters.project_id) params.project_id = filters.project_id
    if (filters.has_tags) params.has_tags = filters.has_tags === 'true'
    if (filters.tag_key) params.tag_key = filters.tag_key
    if (filters.tag_value) params.tag_value = filters.tag_value

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

// 分页
const handleSizeChange = (size: number) => {
  pagination.size = size
  pagination.page = 1
  fetchInstances()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
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
  } catch {
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
  initColumnSettings()
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
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input-wrap {
  position: relative;
  width: 320px;
  flex-shrink: 0;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;

  .search-icon {
    position: absolute;
    left: 12px;
    color: var(--text-muted);
    z-index: 1;
  }

  .search-input {
    width: 100%;
    height: 32px;
    padding: 0 12px 0 36px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
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

.search-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.clear-search-btn {
  color: var(--accent-blue);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;

  &:hover {
    text-decoration: underline;
  }
}

.search-filter-panel {
  margin: -12px;

  .search-filter-title {
    padding: 12px 14px 8px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search-filter-list {
    max-height: 320px;
    overflow-y: auto;
    padding: 4px 6px 8px;
  }

  .search-filter-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .el-icon {
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}

.search-value-panel {
  margin: -12px;

  .search-value-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-subtle);

    .back-icon {
      cursor: pointer;
      color: var(--text-muted);
      padding: 2px;
      border-radius: 4px;
      transition: all 150ms ease;

      &:hover {
        color: var(--text-primary);
        background: var(--bg-hover);
      }
    }
  }

  .search-value-list {
    max-height: 280px;
    overflow-y: auto;
    padding: 6px;
  }

  .search-value-item {
    padding: 10px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 6px;
    transition: all 150ms ease;
    margin-bottom: 2px;

    &:hover {
      background: rgba(59, 130, 246, 0.08);
      color: var(--accent-blue);
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .search-value-input {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
  }
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.clear-btn {
  color: var(--accent-blue);
  flex-shrink: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-dialog-content {
  padding: 0;
}

// 标签筛选面板
.tag-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: -12px;
}

.tag-filter-options {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-subtle);
  padding-bottom: 8px;

  .tag-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    &.active {
      color: var(--accent-blue);
      background: rgba(59, 130, 246, 0.08);
    }
  }
}

.tag-filter-search {
  padding: 0 12px;

  .custom-tag-hint {
    margin-top: 4px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--accent-blue);
    background: rgba(59, 130, 246, 0.08);
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background: rgba(59, 130, 246, 0.12);
    }
  }
}

.tag-key-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 0 4px;

  .tag-key-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    margin: 2px 0;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 150ms ease;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    &.active {
      color: var(--accent-blue);
      background: rgba(59, 130, 246, 0.08);
    }
  }

  .tag-key-empty {
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }
}

.tag-value-input {
  padding: 0 12px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 8px;
}

.tag-filter-footer {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--border-subtle);
}

.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin-left: 4px;
  font-size: 11px;
  background: var(--accent-blue);
  color: white;
  border-radius: 8px;
}

.el-button.is-active {
  color: var(--accent-blue);
  border-color: var(--accent-blue);
}

// 表格区域
.table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-elevated);
}

.table-header {
  flex-shrink: 0;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  overflow: hidden;
}

.table-body {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;

  th, td {
    padding: 10px 12px;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  th {
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-weight: 500;
  }

  td {
    border-bottom: 1px solid var(--border-subtle);
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
.col-name { width: 220px; max-width: 220px; }
.col-actions { width: 110px; }

// 单元格样式
.name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;

  .instance-name {
    color: var(--accent-blue);
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &:hover {
      text-decoration: underline;
    }
  }

  .lock-icon {
    color: var(--text-muted);
    font-size: 12px;
    flex-shrink: 0;
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
  font-size: 20px;
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

.platform-icon {
  font-size: 20px;
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

.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: inline-block;
}

.tags-cell {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: inline-block;
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
