<template>
  <div class="models-page">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-info">
          <h1 class="page-title">资源模型</h1>
          <p class="page-subtitle">管理 CMDB 资源模型定义</p>
        </div>
        <div class="header-actions">
          <el-button class="action-btn" @click="handleInitGroups">
            <el-icon><FolderAdd /></el-icon>
            初始化分组
          </el-button>
          <el-button type="primary" class="action-btn primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            创建模型
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主内容区：左侧分组树 + 右侧模型列表 -->
    <div class="content-wrapper">
      <!-- 左侧分组树 -->
      <div class="group-panel">
        <div class="panel-header">
          <span class="panel-title">模型分组</span>
          <el-button text size="small" @click="handleAddGroup">
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>
        <div class="group-list" v-loading="groupLoading">
          <!-- 全部模型 -->
          <div
            class="group-item"
            :class="{ active: selectedGroupId === null }"
            @click="handleSelectGroup(null)"
          >
            <div class="group-icon">
              <el-icon :size="16"><Grid /></el-icon>
            </div>
            <span class="group-name">全部模型</span>
            <span class="group-count">{{ totalModelCount }}</span>
          </div>

          <!-- 分组列表 -->
          <div
            v-for="group in groups"
            :key="group.id"
            class="group-item"
            :class="{ active: selectedGroupId === group.id }"
            @click="handleSelectGroup(group.id)"
            @contextmenu.prevent="handleGroupContextMenu($event, group)"
          >
            <div class="group-icon">
              <el-icon :size="16"><Folder /></el-icon>
            </div>
            <span class="group-name">{{ group.name }}</span>
            <span class="group-count">{{ group.models?.length || 0 }}</span>
            <el-dropdown v-if="!group.is_builtin" trigger="click" @command="(cmd: string) => handleGroupAction(cmd, group)">
              <button class="group-more" @click.stop>
                <el-icon :size="12"><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <span style="color: var(--accent-red)">删除</span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <!-- 右侧模型列表 -->
      <div class="models-area">
        <!-- 当前分组信息 -->
        <div class="area-header">
          <div class="current-group">
            <h2 class="group-title">{{ currentGroupName }}</h2>
            <span class="model-count">{{ currentModels.length }} 个模型</span>
          </div>
          <div class="area-actions">
            <div class="search-box">
              <el-icon class="search-icon"><Search /></el-icon>
              <input
                v-model="searchKeyword"
                type="text"
                class="search-input"
                placeholder="搜索模型..."
              />
            </div>
          </div>
        </div>

        <!-- 模型卡片网格 -->
        <div class="models-grid" v-loading="loading">
          <div
            v-for="model in filteredModels"
            :key="model.uid"
            class="model-card"
            @click="handleViewDetail(model)"
          >
            <div class="card-header">
              <div class="model-icon" :class="getCategoryClass(model.category)">
                <el-icon :size="20"><component :is="getCategoryIcon(model.category)" /></el-icon>
              </div>
              <el-dropdown trigger="click" @command="(cmd: string) => handleModelAction(cmd, model)" @click.stop>
                <button class="more-btn" @click.stop>
                  <el-icon><MoreFilled /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit"><el-icon><Edit /></el-icon>编辑</el-dropdown-item>
                    <el-dropdown-item command="instances"><el-icon><List /></el-icon>查看实例</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>
                      <el-icon><Delete /></el-icon><span style="color: var(--accent-red)">删除</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="card-body">
              <h3 class="model-name">{{ model.name }}</h3>
              <code class="model-uid">{{ model.uid }}</code>
              <p class="model-desc">{{ model.description || '暂无描述' }}</p>
            </div>
            <div class="card-footer">
              <span class="badge" :class="getCategoryClass(model.category)">{{ getCategoryLabel(model.category) }}</span>
              <span class="badge provider">{{ getProviderLabel(model.provider) }}</span>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!loading && filteredModels.length === 0" class="empty-state">
            <div class="empty-icon"><el-icon :size="48"><Grid /></el-icon></div>
            <div class="empty-title">{{ searchKeyword ? '没有匹配的模型' : '暂无模型' }}</div>
            <div class="empty-desc">{{ searchKeyword ? '尝试其他关键词' : '点击右上角按钮创建模型' }}</div>
          </div>
        </div>
      </div>
    </div><!-- end content-wrapper -->

    <!-- 创建/编辑模型对话框 -->
    <el-dialog v-model="modelDialogVisible" :title="isEditModel ? '编辑模型' : '创建模型'" width="600px" :close-on-click-modal="false">
      <ModelForm ref="modelFormRef" :model="currentModel" :is-edit="isEditModel" :groups="groups" />
      <template #footer>
        <el-button @click="modelDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitModel">确定</el-button>
      </template>
    </el-dialog>

    <!-- 创建/编辑分组对话框 -->
    <el-dialog v-model="groupDialogVisible" :title="isEditGroup ? '编辑分组' : '创建分组'" width="480px" :close-on-click-modal="false">
      <el-form ref="groupFormRef" :model="groupForm" :rules="groupRules" label-width="80px">
        <el-form-item label="标识" prop="uid" v-if="!isEditGroup">
          <el-input v-model="groupForm.uid" placeholder="唯一标识，如 cloud" />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="groupForm.name" placeholder="分组名称" />
        </el-form-item>
        <el-form-item label="图标" prop="icon">
          <el-input v-model="groupForm.icon" placeholder="图标名称" />
        </el-form-item>
        <el-form-item label="排序" prop="sort_order">
          <el-input-number v-model="groupForm.sort_order" :min="0" :max="999" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="groupForm.description" type="textarea" :rows="2" placeholder="分组描述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="groupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitGroup">确定</el-button>
      </template>
    </el-dialog>

    <!-- 模型详情抽屉 -->
    <ModelDetailDrawer v-model:visible="detailDrawerVisible" :model="detailModel" @edit="handleEditModel" @delete="handleDeleteModel" />
  </div>
</template>

<script setup lang="ts">
import {
  createModelGroupApi, deleteCmdbModelApi, deleteModelGroupApi,
  initBuiltinModelGroupsApi, listModelGroupsWithModelsApi, updateModelGroupApi
} from '@/api/cmdb'
import type { ModelGroupWithModelsVO, ModelVO } from '@/api/types/cmdb'
import {
  Coin, Connection, Delete, Edit, Folder, FolderAdd, Grid, List, Monitor, MoreFilled, Plus, Search
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import ModelDetailDrawer from './components/ModelDetailDrawer.vue'
import ModelForm from './components/ModelForm.vue'

const router = useRouter()

// 状态
const loading = ref(false)
const groupLoading = ref(false)
const submitting = ref(false)
const groups = ref<ModelGroupWithModelsVO[]>([])
const selectedGroupId = ref<number | null>(null)
const searchKeyword = ref('')

// 模型对话框
const modelDialogVisible = ref(false)
const isEditModel = ref(false)
const modelFormRef = ref()
const currentModel = ref<ModelVO | null>(null)

// 分组对话框
const groupDialogVisible = ref(false)
const isEditGroup = ref(false)
const groupFormRef = ref<FormInstance>()
const currentGroup = ref<ModelGroupWithModelsVO | null>(null)
const groupForm = reactive({
  uid: '',
  name: '',
  icon: '',
  sort_order: 0,
  description: ''
})
const groupRules: FormRules = {
  uid: [{ required: true, message: '请输入分组标识', trigger: 'blur' }],
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }]
}

// 详情抽屉
const detailDrawerVisible = ref(false)
const detailModel = ref<ModelVO | null>(null)

// 计算属性
const totalModelCount = computed(() => groups.value.reduce((sum, g) => sum + (g.models?.length || 0), 0))

const currentGroupName = computed(() => {
  if (selectedGroupId.value === null) return '全部模型'
  const group = groups.value.find(g => g.id === selectedGroupId.value)
  return group?.name || '全部模型'
})

const currentModels = computed(() => {
  if (selectedGroupId.value === null) {
    return groups.value.flatMap(g => g.models || [])
  }
  const group = groups.value.find(g => g.id === selectedGroupId.value)
  return group?.models || []
})

const filteredModels = computed(() => {
  if (!searchKeyword.value) return currentModels.value
  const keyword = searchKeyword.value.toLowerCase()
  return currentModels.value.filter(m =>
    m.name.toLowerCase().includes(keyword) ||
    m.uid.toLowerCase().includes(keyword) ||
    m.description?.toLowerCase().includes(keyword)
  )
})

// 辅助函数
const getCategoryLabel = (category: string) => {
  const map: Record<string, string> = { compute: '计算', storage: '存储', network: '网络', database: '数据库', security: '安全', iam: 'IAM' }
  return map[category] || category
}

const getCategoryClass = (category: string) => {
  const map: Record<string, string> = { compute: 'blue', storage: 'purple', network: 'orange', database: 'green', security: 'red', iam: 'cyan' }
  return map[category] || 'blue'
}

const getCategoryIcon = (category: string) => {
  const map: Record<string, any> = { compute: Monitor, storage: Coin, network: Connection, database: Grid, security: Grid, iam: Grid }
  return map[category] || Grid
}

const getProviderLabel = (provider: string) => {
  const map: Record<string, string> = { aliyun: '阿里云', aws: 'AWS', azure: 'Azure', all: '通用' }
  return map[provider] || provider
}

// 获取分组和模型数据
const fetchGroupsWithModels = async () => {
  groupLoading.value = true
  loading.value = true
  try {
    const response = await listModelGroupsWithModelsApi()
    const data = response.data as any
    groups.value = data?.data?.groups || data?.groups || []
    console.log('分组数据:', groups.value.map(g => ({ uid: g.uid, name: g.name, id: g.id })))
  } catch (error) {
    console.error('获取分组失败:', error)
    ElMessage.error('获取分组失败')
  } finally {
    groupLoading.value = false
    loading.value = false
  }
}

// 初始化内置分组
const handleInitGroups = async () => {
  try {
    await initBuiltinModelGroupsApi()
    ElMessage.success('初始化成功')
    fetchGroupsWithModels()
  } catch (error) {
    console.error('初始化失败:', error)
    ElMessage.error('初始化失败')
  }
}

// 选择分组
const handleSelectGroup = (groupId: number | null) => {
  selectedGroupId.value = groupId
}

// 分组右键菜单（预留）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleGroupContextMenu = (_event: MouseEvent, _group: ModelGroupWithModelsVO) => {
  // 预留右键菜单功能
}

// 分组操作
const handleGroupAction = (command: string, group: ModelGroupWithModelsVO) => {
  if (command === 'edit') {
    handleEditGroup(group)
  } else if (command === 'delete') {
    handleDeleteGroup(group)
  }
}

// 添加分组
const handleAddGroup = () => {
  isEditGroup.value = false
  currentGroup.value = null
  groupForm.uid = ''
  groupForm.name = ''
  groupForm.icon = ''
  groupForm.sort_order = 0
  groupForm.description = ''
  groupDialogVisible.value = true
}

// 编辑分组
const handleEditGroup = (group: ModelGroupWithModelsVO) => {
  isEditGroup.value = true
  currentGroup.value = group
  groupForm.uid = group.uid
  groupForm.name = group.name
  groupForm.icon = group.icon || ''
  groupForm.sort_order = group.sort_order
  groupForm.description = group.description || ''
  groupDialogVisible.value = true
}

// 删除分组
const handleDeleteGroup = async (group: ModelGroupWithModelsVO) => {
  if (group.models && group.models.length > 0) {
    ElMessage.warning('该分组下有模型，无法删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要删除分组"${group.name}"吗？`, '确认删除', { type: 'warning' })
    await deleteModelGroupApi(group.uid)
    ElMessage.success('删除成功')
    if (selectedGroupId.value === group.id) selectedGroupId.value = null
    fetchGroupsWithModels()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error('删除失败')
  }
}

// 提交分组
const handleSubmitGroup = async () => {
  if (!groupFormRef.value) return
  await groupFormRef.value.validate()
  submitting.value = true
  try {
    if (isEditGroup.value && currentGroup.value) {
      await updateModelGroupApi(currentGroup.value.uid, {
        name: groupForm.name,
        icon: groupForm.icon,
        sort_order: groupForm.sort_order,
        description: groupForm.description
      })
    } else {
      await createModelGroupApi(groupForm)
    }
    ElMessage.success(isEditGroup.value ? '更新成功' : '创建成功')
    groupDialogVisible.value = false
    fetchGroupsWithModels()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 模型操作
const handleAdd = () => {
  isEditModel.value = false
  currentModel.value = null
  modelDialogVisible.value = true
}

const handleEditModel = (model: ModelVO) => {
  isEditModel.value = true
  currentModel.value = model
  modelDialogVisible.value = true
}

const handleViewDetail = (model: ModelVO) => {
  detailModel.value = model
  detailDrawerVisible.value = true
}

const handleModelAction = (command: string, model: ModelVO) => {
  if (command === 'edit') handleEditModel(model)
  else if (command === 'instances') router.push({ path: '/cmdb/instances', query: { model_uid: model.uid } })
  else if (command === 'delete') handleDeleteModel(model)
}

const handleDeleteModel = async (model: ModelVO) => {
  try {
    await ElMessageBox.confirm(`确定要删除模型"${model.name}"吗？`, '确认删除', { type: 'warning' })
    await deleteCmdbModelApi(model.uid)
    ElMessage.success('删除成功')
    fetchGroupsWithModels()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleSubmitModel = async () => {
  if (!modelFormRef.value) return
  try {
    submitting.value = true
    await modelFormRef.value.submit()
    ElMessage.success(isEditModel.value ? '更新成功' : '创建成功')
    modelDialogVisible.value = false
    fetchGroupsWithModels()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchGroupsWithModels()
})
</script>

<style scoped lang="scss">
@import './styles/models.scss';
</style>
