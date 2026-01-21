<template>
  <div class="relations-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">模型关系</h1>
          <p class="page-subtitle">定义资源模型之间的关联关系</p>
        </div>
        <div class="header-actions">
          <el-button class="action-btn" @click="handleRefresh">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button type="primary" class="action-btn primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            创建关系
          </el-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon blue">
          <el-icon :size="20"><Connection /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ pagination.total }}</div>
          <div class="stat-label">关系总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon :size="20"><Link /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ belongsToCount }}</div>
          <div class="stat-label">归属关系</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon purple">
          <el-icon :size="20"><Share /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ bindtoCount }}</div>
          <div class="stat-label">绑定关系</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">
          <el-icon :size="20"><SetUp /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-value">{{ dependsOnCount }}</div>
          <div class="stat-label">依赖关系</div>
        </div>
      </div>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <div class="filter-row">
        <div class="search-box">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="filters.keyword"
            type="text"
            class="search-input"
            placeholder="搜索关系名称..."
            @input="handleSearchInput"
          />
          <el-icon v-if="filters.keyword" class="clear-icon" @click="filters.keyword = ''; handleFilterChange()">
            <Close />
          </el-icon>
        </div>
        <div class="filter-controls">
          <div class="filter-item">
            <span class="filter-label">关系类型</span>
            <el-select
              v-model="filters.relation_type"
              placeholder="全部"
              clearable
              class="filter-select"
              @change="handleFilterChange"
            >
              <el-option label="归属 (belongs_to)" value="belongs_to" />
              <el-option label="包含 (contains)" value="contains" />
              <el-option label="绑定 (bindto)" value="bindto" />
              <el-option label="连接 (connects)" value="connects" />
              <el-option label="依赖 (depends_on)" value="depends_on" />
            </el-select>
          </div>
          <div class="filter-item">
            <span class="filter-label">源模型</span>
            <el-select
              v-model="filters.source_uid"
              placeholder="全部"
              clearable
              filterable
              class="filter-select"
              @change="handleFilterChange"
            >
              <el-option
                v-for="model in modelOptions"
                :key="model.uid"
                :label="model.name"
                :value="model.uid"
              />
            </el-select>
          </div>
          <el-button v-if="hasFilters" text class="reset-btn" @click="handleResetFilters">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </div>
      </div>
    </div>

    <!-- 关系列表 -->
    <div class="relations-list" v-loading="loading">
      <div class="list-header">
        <div class="col-relation">关系</div>
        <div class="col-source">源模型</div>
        <div class="col-target">目标模型</div>
        <div class="col-type">类型</div>
        <div class="col-direction">方向</div>
        <div class="col-time">更新时间</div>
        <div class="col-actions">操作</div>
      </div>

      <TransitionGroup name="list">
        <div
          v-for="relation in relations"
          :key="relation.uid"
          class="relation-item"
          @click="handleViewDetail(relation)"
        >
          <div class="col-relation">
            <div class="relation-icon blue">
              <el-icon :size="18"><Connection /></el-icon>
            </div>
            <div class="relation-info">
              <div class="relation-name">{{ relation.name }}</div>
              <div class="relation-uid">{{ relation.uid }}</div>
            </div>
          </div>
          <div class="col-source">
            <code class="model-code">{{ relation.source_uid }}</code>
          </div>
          <div class="col-target">
            <code class="model-code">{{ relation.target_uid }}</code>
          </div>
          <div class="col-type">
            <span class="type-badge" :class="getTypeClass(relation.relation_type)">
              {{ getTypeLabel(relation.relation_type) }}
            </span>
          </div>
          <div class="col-direction">
            <span class="direction-text">{{ getDirectionLabel(relation.direction) }}</span>
          </div>
          <div class="col-time">
            {{ formatTime(relation.update_time) }}
          </div>
          <div class="col-actions" @click.stop>
            <el-dropdown trigger="click" @command="(cmd: string) => handleAction(cmd, relation)">
              <button class="action-trigger">
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">
                    <el-icon><Edit /></el-icon>
                    编辑
                  </el-dropdown-item>
                  <el-dropdown-item divided command="delete">
                    <el-icon><Delete /></el-icon>
                    <span style="color: var(--accent-red)">删除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </TransitionGroup>

      <!-- 空状态 -->
      <div v-if="!loading && relations.length === 0" class="empty-state">
        <div class="empty-icon">
          <el-icon :size="48"><Connection /></el-icon>
        </div>
        <div class="empty-title">{{ hasFilters ? '没有符合条件的关系' : '暂无模型关系' }}</div>
        <div class="empty-desc">{{ hasFilters ? '尝试调整筛选条件' : '点击上方按钮创建第一个模型关系' }}</div>
        <div class="empty-actions">
          <el-button v-if="hasFilters" @click="handleResetFilters">清除筛选</el-button>
          <el-button v-else type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            创建关系
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="pagination.total > 0" class="pagination-bar">
      <div class="pagination-info">
        共 <strong>{{ pagination.total }}</strong> 条记录
      </div>
      <div class="pagination-controls">
        <button class="page-btn" :disabled="pagination.page === 1" @click="handleCurrentChange(pagination.page - 1)">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="page-numbers">
          <button
            v-for="page in visiblePages"
            :key="page"
            class="page-num"
            :class="{ active: page === pagination.page, ellipsis: page === '...' }"
            :disabled="page === '...'"
            @click="page !== '...' && handleCurrentChange(Number(page))"
          >
            {{ page }}
          </button>
        </div>
        <button class="page-btn" :disabled="pagination.page === totalPages" @click="handleCurrentChange(pagination.page + 1)">
          <el-icon><ArrowRight /></el-icon>
        </button>
        <el-select v-model="pagination.size" class="size-select" @change="handleSizeChange">
          <el-option :value="10" label="10 条/页" />
          <el-option :value="20" label="20 条/页" />
          <el-option :value="50" label="50 条/页" />
        </el-select>
      </div>
    </div>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="640px"
      :close-on-click-modal="false"
      class="modern-dialog"
      @closed="handleDialogClosed"
    >
      <RelationForm ref="formRef" :relation="currentRelation" :is-edit="isEdit" :models="modelOptions" />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <RelationDetailDrawer
      v-model:visible="detailDrawerVisible"
      :relation="detailRelation"
      @edit="handleEdit"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { deleteModelRelationApi, listCmdbModelsApi, listModelRelationsApi } from '@/api'
import type { ModelRelationVO, ModelVO } from '@/api/types/cmdb'
import {
  ArrowLeft,
  ArrowRight,
  Close,
  Connection,
  Delete,
  Edit,
  Link,
  MoreFilled,
  Plus,
  Refresh,
  RefreshLeft,
  Search,
  SetUp,
  Share
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import RelationDetailDrawer from './components/RelationDetailDrawer.vue'
import RelationForm from './components/RelationForm.vue'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref()
const currentRelation = ref<ModelRelationVO | null>(null)

const relations = ref<ModelRelationVO[]>([])
const modelOptions = ref<ModelVO[]>([])

const filters = reactive({
  keyword: '',
  relation_type: '',
  source_uid: '',
})

const searchTimer = ref<number | null>(null)

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const dialogTitle = computed(() => (isEdit.value ? '编辑关系' : '创建关系'))
const hasFilters = computed(() => filters.keyword || filters.relation_type || filters.source_uid)
const totalPages = computed(() => Math.ceil(pagination.total / pagination.size) || 1)

const belongsToCount = computed(() => relations.value.filter(r => r.relation_type === 'belongs_to').length)
const bindtoCount = computed(() => relations.value.filter(r => r.relation_type === 'bindto').length)
const dependsOnCount = computed(() => relations.value.filter(r => r.relation_type === 'depends_on').length)

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const total = totalPages.value
  const current = pagination.page
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...', total)
    } else if (current >= total - 3) {
      pages.push(1, '...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1, '...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...', total)
    }
  }
  return pages
})

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    belongs_to: '归属',
    contains: '包含',
    bindto: '绑定',
    connects: '连接',
    depends_on: '依赖',
  }
  return map[type] || type
}

const getTypeClass = (type: string) => {
  const map: Record<string, string> = {
    belongs_to: 'green',
    contains: 'blue',
    bindto: 'purple',
    connects: 'orange',
    depends_on: 'cyan',
  }
  return map[type] || 'blue'
}

const getDirectionLabel = (direction: string) => {
  const map: Record<string, string> = {
    one_to_one: '一对一',
    one_to_many: '一对多',
    many_to_many: '多对多',
    many_to_one: '多对一',
  }
  return map[direction] || direction || '-'
}

const formatTime = (time: number | undefined) => {
  if (!time) return '-'
  return new Date(time).toLocaleDateString('zh-CN')
}

const fetchModels = async () => {
  try {
    const response = await listCmdbModelsApi({ limit: 100 })
    const data = response.data as any
    modelOptions.value = data?.data?.models || data?.models || []
  } catch (error) {
    console.error('获取模型列表失败:', error)
  }
}

const fetchRelations = async () => {
  loading.value = true
  try {
    const params = {
      source_uid: filters.source_uid || undefined,
      relation_type: filters.relation_type || undefined,
      offset: (pagination.page - 1) * pagination.size,
      limit: pagination.size,
    }
    const response = await listModelRelationsApi(params)
    const data = response.data as any
    relations.value = data?.data?.relations || data?.relations || []
    pagination.total = data?.data?.total || data?.total || 0
  } catch (error) {
    console.error('获取关系列表失败:', error)
    ElMessage.error('获取关系列表失败')
    relations.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const handleRefresh = () => fetchRelations()

const handleFilterChange = () => {
  pagination.page = 1
  fetchRelations()
}

const handleResetFilters = () => {
  filters.keyword = ''
  filters.relation_type = ''
  filters.source_uid = ''
  pagination.page = 1
  fetchRelations()
}

const handleSearchInput = () => {
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = window.setTimeout(() => {
    pagination.page = 1
    fetchRelations()
  }, 500)
}

const handleSizeChange = () => {
  pagination.page = 1
  fetchRelations()
}

const handleCurrentChange = (page: number) => {
  pagination.page = page
  fetchRelations()
}

const handleAdd = () => {
  isEdit.value = false
  currentRelation.value = null
  dialogVisible.value = true
}

const handleEdit = (relation: ModelRelationVO) => {
  isEdit.value = true
  currentRelation.value = relation
  dialogVisible.value = true
}

const detailDrawerVisible = ref(false)
const detailRelation = ref<ModelRelationVO | null>(null)

const handleViewDetail = (relation: ModelRelationVO) => {
  detailRelation.value = relation
  detailDrawerVisible.value = true
}

const handleAction = (command: string, relation: ModelRelationVO) => {
  if (command === 'edit') handleEdit(relation)
  else if (command === 'delete') handleDelete(relation)
}

const handleDelete = async (relation: ModelRelationVO) => {
  try {
    await ElMessageBox.confirm(`确定要删除关系"${relation.name}"吗？`, '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteModelRelationApi(relation.uid)
    ElMessage.success('删除成功')
    detailDrawerVisible.value = false
    fetchRelations()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    submitting.value = true
    await formRef.value.submit()
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    fetchRelations()
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDialogClosed = () => {
  currentRelation.value = null
  if (formRef.value) formRef.value.reset()
}

onMounted(() => {
  fetchModels()
  fetchRelations()
})
</script>

<style scoped lang="scss">
@import './styles/relations.scss';
</style>
