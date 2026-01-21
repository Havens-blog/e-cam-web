<template>
  <el-drawer :model-value="visible" title="模型详情" size="640px" @update:model-value="handleClose">
    <template v-if="model">
      <el-tabs v-model="activeTab" class="detail-tabs">
        <el-tab-pane label="基本信息" name="basic">
          <div class="detail-content">
            <div class="detail-section">
              <div class="section-header">
                <div class="model-avatar" :class="getCategoryClass(model.category)">
                  <el-icon :size="24"><component :is="getCategoryIcon(model.category)" /></el-icon>
                </div>
                <div class="model-title">
                  <h3>{{ model.name }}</h3>
                  <code class="model-uid">{{ model.uid }}</code>
                </div>
              </div>
            </div>
            <div class="detail-section">
              <h4 class="section-title">分类信息</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">类别</span>
                  <span class="category-badge" :class="getCategoryClass(model.category)">
                    {{ getCategoryLabel(model.category) }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">云厂商</span>
                  <span class="info-value">{{ getProviderLabel(model.provider) }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="模型属性" name="attributes">
          <div class="attributes-content">
            <div class="attr-toolbar">
              <el-button type="primary" size="small" @click="handleAddAttribute">
                <el-icon><Plus /></el-icon>新增属性
              </el-button>
              <el-button size="small" @click="handleAddAttrGroup">
                <el-icon><FolderAdd /></el-icon>新增分组
              </el-button>
            </div>
            <div class="attr-groups" v-loading="attrLoading">
              <div v-for="group in attributeGroups" :key="group.id" class="attr-group">
                <div class="group-header">
                  <div class="group-info">
                    <el-icon><Folder /></el-icon>
                    <span class="group-name">{{ group.name }}</span>
                    <span class="attr-count">{{ group.attributes?.length || 0 }}</span>
                  </div>
                  <div class="group-actions" v-if="!group.is_builtin">
                    <el-button text size="small" @click="handleEditAttrGroup(group)">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                    <el-button text size="small" @click="handleDeleteAttrGroup(group)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
                <div class="attr-list">
                  <div v-for="attr in group.attributes" :key="attr.id" class="attr-item">
                    <div class="attr-info">
                      <span class="attr-name">{{ attr.field_name }}</span>
                      <code class="attr-uid">{{ attr.field_uid }}</code>
                    </div>
                    <div class="attr-meta">
                      <span class="type-badge">{{ getFieldTypeLabel(attr.field_type) }}</span>
                      <span v-if="attr.required" class="tag required">必填</span>
                      <span v-if="attr.unique" class="tag unique">唯一</span>
                    </div>
                    <div class="attr-actions">
                      <el-button text size="small" @click="handleEditAttribute(attr)">
                        <el-icon><Edit /></el-icon>
                      </el-button>
                      <el-button text size="small" @click="handleDeleteAttribute(attr)">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>
                  <div v-if="!group.attributes?.length" class="empty-attrs">暂无属性</div>
                </div>
              </div>
              <div v-if="!attrLoading && !attributeGroups.length" class="empty-state">
                <el-icon :size="32"><Grid /></el-icon>
                <p>暂无属性分组</p>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </template>
    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleClose">关闭</el-button>
        <el-button type="primary" :disabled="!model" @click="model && $emit('edit', model)">
          <el-icon><Edit /></el-icon>编辑
        </el-button>
        <el-button type="danger" plain :disabled="!model" @click="model && $emit('delete', model)">
          <el-icon><Delete /></el-icon>删除
        </el-button>
      </div>
    </template>
  </el-drawer>

  <!-- 属性表单对话框 -->
  <el-dialog v-model="attrDialogVisible" :title="isEditAttr ? '编辑属性' : '新增属性'" width="560px">
    <el-form ref="attrFormRef" :model="attrForm" :rules="attrRules" label-width="90px">
      <el-form-item label="字段标识" prop="field_uid" v-if="!isEditAttr">
        <el-input v-model="attrForm.field_uid" placeholder="如 instance_id" />
      </el-form-item>
      <el-form-item label="字段名称" prop="field_name">
        <el-input v-model="attrForm.field_name" placeholder="如 实例ID" />
      </el-form-item>
      <el-form-item label="字段类型" prop="field_type">
        <el-select v-model="attrForm.field_type" style="width: 100%">
          <el-option v-for="t in fieldTypes" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="所属分组">
        <el-select v-model="attrForm.group_id" style="width: 100%" clearable>
          <el-option v-for="g in attributeGroups" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="选项值" v-if="attrForm.field_type === 'enum'">
        <el-input v-model="attrForm.option" type="textarea" :rows="2" placeholder='["选项1","选项2"]' />
      </el-form-item>
      <el-form-item label="默认值">
        <el-input v-model="attrForm.default" placeholder="默认值" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="attrForm.description" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="属性配置">
        <div class="attr-switches">
          <el-checkbox v-model="attrForm.required">必填</el-checkbox>
          <el-checkbox v-model="attrForm.unique">唯一</el-checkbox>
          <el-checkbox v-model="attrForm.searchable">可搜索</el-checkbox>
          <el-checkbox v-model="attrForm.editable">可编辑</el-checkbox>
          <el-checkbox v-model="attrForm.display">显示</el-checkbox>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="attrDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmitAttribute">确定</el-button>
    </template>
  </el-dialog>

  <!-- 分组表单对话框 -->
  <el-dialog v-model="groupDialogVisible" :title="isEditGroup ? '编辑分组' : '新增分组'" width="480px">
    <el-form ref="groupFormRef" :model="groupForm" :rules="groupRules" label-width="80px">
      <el-form-item label="标识" prop="uid" v-if="!isEditGroup">
        <el-input v-model="groupForm.uid" placeholder="分组标识" />
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input v-model="groupForm.name" placeholder="分组名称" />
      </el-form-item>
      <el-form-item label="排序">
        <el-input-number v-model="groupForm.index" :min="0" :max="999" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="groupForm.description" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="groupDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmitAttrGroup">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {
  createAttributeApi,
  createAttributeGroupApi,
  deleteAttributeApi,
  deleteAttributeGroupApi,
  getFieldTypesApi,
  listAttributesWithGroupsApi,
  updateAttributeApi,
  updateAttributeGroupApi
} from '@/api/cmdb'
import type {
  AttributeGroupWithAttrsVO,
  AttributeVO,
  FieldTypeVO,
  ModelVO
} from '@/api/types/cmdb'
import {
  Coin,
  Connection,
  Delete,
  Edit,
  Folder,
  FolderAdd,
  Grid,
  Monitor,
  Plus
} from '@element-plus/icons-vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules
} from 'element-plus'
import { reactive, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  model: ModelVO | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  edit: [model: ModelVO]
  delete: [model: ModelVO]
}>()

const activeTab = ref('basic')
const attrLoading = ref(false)
const attributeGroups = ref<AttributeGroupWithAttrsVO[]>([])
const fieldTypes = ref<FieldTypeVO[]>([])
const submitting = ref(false)

// 属性表单
const attrDialogVisible = ref(false)
const isEditAttr = ref(false)
const currentAttr = ref<AttributeVO | null>(null)
const attrFormRef = ref<FormInstance>()
const attrForm = reactive({
  field_uid: '',
  field_name: '',
  field_type: 'string',
  group_id: undefined as number | undefined,
  option: '',
  default: '',
  description: '',
  required: false,
  unique: false,
  searchable: false,
  editable: true,
  display: true
})
const attrRules: FormRules = {
  field_uid: [{ required: true, message: '请输入字段标识', trigger: 'blur' }],
  field_name: [{ required: true, message: '请输入字段名称', trigger: 'blur' }],
  field_type: [{ required: true, message: '请选择字段类型', trigger: 'change' }]
}

// 分组表单
const groupDialogVisible = ref(false)
const isEditGroup = ref(false)
const currentGroup = ref<AttributeGroupWithAttrsVO | null>(null)
const groupFormRef = ref<FormInstance>()
const groupForm = reactive({ uid: '', name: '', index: 0, description: '' })
const groupRules: FormRules = {
  uid: [{ required: true, message: '请输入分组标识', trigger: 'blur' }],
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }]
}

watch(() => props.visible, async (val) => {
  if (val && props.model) {
    activeTab.value = 'basic'
    await fetchFieldTypes()
    await fetchAttributes()
  }
})

watch(activeTab, async (tab) => {
  if (tab === 'attributes' && props.model && !attributeGroups.value.length) {
    await fetchAttributes()
  }
})

const fetchFieldTypes = async () => {
  if (fieldTypes.value.length) return
  try {
    const res = await getFieldTypesApi()
    const data = res.data as any
    fieldTypes.value = data?.data || data || []
  } catch {
    fieldTypes.value = [
      { value: 'string', label: '短文本' },
      { value: 'text', label: '长文本' },
      { value: 'int', label: '整数' },
      { value: 'float', label: '浮点数' },
      { value: 'bool', label: '布尔' },
      { value: 'enum', label: '枚举' },
      { value: 'datetime', label: '日期时间' },
      { value: 'date', label: '日期' },
      { value: 'json', label: 'JSON' }
    ]
  }
}

const fetchAttributes = async () => {
  if (!props.model) return
  attrLoading.value = true
  try {
    const res = await listAttributesWithGroupsApi(props.model.uid)
    const data = res.data as any
    console.log('fetchAttributes response:', data)
    // 处理不同的响应结构
    if (Array.isArray(data)) {
      attributeGroups.value = data
    } else if (Array.isArray(data?.data)) {
      attributeGroups.value = data.data
    } else {
      attributeGroups.value = []
    }
  } catch (e) {
    console.error('获取属性失败:', e)
  } finally {
    attrLoading.value = false
  }
}

const getFieldTypeLabel = (type: string) => {
  return fieldTypes.value.find(t => t.value === type)?.label || type
}

const handleClose = () => {
  emit('update:visible', false)
  attributeGroups.value = []
}

const handleAddAttribute = () => {
  isEditAttr.value = false
  currentAttr.value = null
  Object.assign(attrForm, {
    field_uid: '', field_name: '', field_type: 'string', group_id: undefined,
    option: '', default: '', description: '',
    required: false, unique: false, searchable: false, editable: true, display: true
  })
  attrDialogVisible.value = true
}

const handleEditAttribute = (attr: AttributeVO) => {
  isEditAttr.value = true
  currentAttr.value = attr
  Object.assign(attrForm, {
    field_uid: attr.field_uid,
    field_name: attr.field_name,
    field_type: attr.field_type,
    group_id: attr.group_id,
    option: attr.option || '',
    default: attr.default || '',
    description: attr.description || '',
    required: attr.required,
    unique: attr.unique,
    searchable: attr.searchable,
    editable: attr.editable,
    display: attr.display
  })
  attrDialogVisible.value = true
}

const handleDeleteAttribute = async (attr: AttributeVO) => {
  if (!props.model) return
  try {
    await ElMessageBox.confirm(`确定删除属性"${attr.field_name}"吗？`, '确认删除', { type: 'warning' })
    await deleteAttributeApi(props.model.uid, attr.id)
    ElMessage.success('删除成功')
    fetchAttributes()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleSubmitAttribute = async () => {
  if (!attrFormRef.value || !props.model) return
  await attrFormRef.value.validate()
  submitting.value = true
  try {
    if (isEditAttr.value && currentAttr.value) {
      await updateAttributeApi(props.model.uid, currentAttr.value.id, attrForm as any)
    } else {
      await createAttributeApi(props.model.uid, attrForm as any)
    }
    ElMessage.success(isEditAttr.value ? '更新成功' : '创建成功')
    attrDialogVisible.value = false
    fetchAttributes()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

const handleAddAttrGroup = () => {
  isEditGroup.value = false
  currentGroup.value = null
  Object.assign(groupForm, { uid: '', name: '', index: 0, description: '' })
  groupDialogVisible.value = true
}

const handleEditAttrGroup = (group: AttributeGroupWithAttrsVO) => {
  isEditGroup.value = true
  currentGroup.value = group
  Object.assign(groupForm, {
    uid: group.uid,
    name: group.name,
    index: group.index,
    description: group.description || ''
  })
  groupDialogVisible.value = true
}

const handleDeleteAttrGroup = async (group: AttributeGroupWithAttrsVO) => {
  if (!props.model) return
  if (group.attributes?.length) {
    ElMessage.warning('该分组下有属性，无法删除')
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除分组"${group.name}"吗？`, '确认删除', { type: 'warning' })
    await deleteAttributeGroupApi(props.model.uid, group.id)
    ElMessage.success('删除成功')
    fetchAttributes()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleSubmitAttrGroup = async () => {
  if (!groupFormRef.value || !props.model) return
  await groupFormRef.value.validate()
  submitting.value = true
  try {
    if (isEditGroup.value && currentGroup.value) {
      await updateAttributeGroupApi(props.model.uid, currentGroup.value.id, groupForm)
    } else {
      await createAttributeGroupApi(props.model.uid, groupForm)
    }
    ElMessage.success(isEditGroup.value ? '更新成功' : '创建成功')
    groupDialogVisible.value = false
    fetchAttributes()
  } catch {
    ElMessage.error('操作失败')
  } finally {
    submitting.value = false
  }
}

// 辅助函数
const getCategoryLabel = (category: string) => {
  const map: Record<string, string> = {
    compute: '计算', storage: '存储', network: '网络',
    database: '数据库', security: '安全', iam: 'IAM'
  }
  return map[category] || category
}

const getCategoryClass = (category: string) => {
  const map: Record<string, string> = {
    compute: 'blue', storage: 'purple', network: 'orange',
    database: 'green', security: 'red', iam: 'cyan'
  }
  return map[category] || 'blue'
}

const getCategoryIcon = (category: string) => {
  const map: Record<string, any> = {
    compute: Monitor, storage: Coin, network: Connection,
    database: Grid, security: Grid, iam: Grid
  }
  return map[category] || Grid
}

const getProviderLabel = (provider: string) => {
  const map: Record<string, string> = {
    aliyun: '阿里云', aws: 'AWS', azure: 'Azure', all: '通用'
  }
  return map[provider] || provider
}
</script>

<style scoped lang="scss">
.detail-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
  :deep(.el-tabs__header) { margin-bottom: 16px; }
  :deep(.el-tabs__content) { flex: 1; overflow: auto; }
}

.detail-content { padding: 0 4px; }

.detail-section {
  margin-bottom: 24px;

  .section-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;

    .model-avatar {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;

      &.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
      &.green { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
      &.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
      &.orange { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
      &.red { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
      &.cyan { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
    }

    .model-title {
      h3 {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 4px 0;
      }
      .model-uid {
        font-size: 13px;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
        background: var(--bg-hover);
        padding: 2px 8px;
        border-radius: 4px;
      }
    }
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 12px 0;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  .info-label { font-size: 12px; color: var(--text-muted); }
  .info-value { font-size: 14px; color: var(--text-primary); }
}

.category-badge {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;

  &.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
  &.green { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
  &.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
  &.orange { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
  &.red { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
  &.cyan { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
}

.attributes-content { padding: 0 4px; }
.attr-toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
.attr-groups { display: flex; flex-direction: column; gap: 16px; }

.attr-group {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  overflow: hidden;

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-hover);
    border-bottom: 1px solid var(--border-subtle);

    .group-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);
      .group-name { font-weight: 500; color: var(--text-primary); }
      .attr-count {
        font-size: 12px;
        background: var(--bg-surface);
        padding: 2px 8px;
        border-radius: 10px;
        color: var(--text-tertiary);
      }
    }
    .group-actions { display: flex; gap: 4px; }
  }

  .attr-list { padding: 8px; }

  .attr-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    transition: background 200ms ease;

    &:hover { background: var(--bg-hover); }
    &:hover .attr-actions { opacity: 1; }

    .attr-info {
      flex: 1;
      min-width: 0;
      .attr-name { font-size: 14px; font-weight: 500; color: var(--text-primary); display: block; }
      .attr-uid { font-size: 12px; color: var(--text-tertiary); font-family: var(--font-mono); }
    }

    .attr-meta {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
      .type-badge {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(59, 130, 246, 0.15);
        color: var(--accent-blue);
      }
      .tag {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--bg-hover);
        color: var(--text-tertiary);
        &.required { background: rgba(239, 68, 68, 0.15); color: var(--accent-red); }
        &.unique { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
      }
    }

    .attr-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 200ms ease;
    }
  }

  .empty-attrs {
    padding: 20px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
  }
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  p { margin: 12px 0 0; }
}

.attr-switches { display: flex; flex-wrap: wrap; gap: 16px; }
.drawer-footer { display: flex; gap: 10px; justify-content: flex-end; }
</style>
