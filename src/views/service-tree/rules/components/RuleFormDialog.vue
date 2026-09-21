<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑规则' : '新建规则'"
    width="680px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
      label-position="right"
    >
      <el-form-item label="规则名称" prop="name">
        <el-input v-model="form.name" placeholder="如: 生产环境订单服务自动归属" maxlength="128" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="目标节点" prop="nodeId">
            <el-tree-select
              v-model="form.nodeId"
              :data="treeData"
              :props="{ label: 'name', value: 'id', children: 'children' }"
              placeholder="选择目标节点"
              check-strictly
              filterable
              style="width: 100%"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="目标环境" prop="envId">
            <el-select v-model="form.envId" placeholder="选择环境" style="width: 100%">
              <el-option
                v-for="env in environmentList"
                :key="env.id"
                :label="env.name"
                :value="env.id"
              >
                <span class="env-option">
                  <span class="env-dot" :style="{ background: env.color }"></span>
                  {{ env.name }}
                </span>
              </el-option>
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="优先级" prop="priority">
        <el-input-number v-model="form.priority" :min="1" :max="999" />
        <span class="form-tip">数字越小优先级越高</span>
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          placeholder="规则描述（可选）"
          maxlength="512"
        />
      </el-form-item>

      <!-- 匹配条件 -->
      <el-form-item label="匹配条件" required>
        <div class="conditions-section">
          <div class="conditions-header">
            <span class="hint">满足所有条件时触发绑定，支持下拉选择或直接输入自定义 tag.xxx / attributes.xxx 字段</span>
            <el-button type="primary" text size="small" @click="addCondition">
              <el-icon><Plus /></el-icon>
              添加条件
            </el-button>
          </div>
          <div class="conditions-list">
            <div v-for="(condition, index) in form.conditions" :key="index" class="condition-item">
              <el-select
                v-model="condition.field"
                placeholder="选择或输入字段"
                style="width: 220px"
                allow-create
                filterable
                default-first-option
              >
                <el-option-group label="基础字段">
                  <el-option label="资源名称 (name)" value="name" />
                  <el-option label="资产ID (asset_id)" value="asset_id" />
                  <el-option label="模型UID (model_uid)" value="model_uid" />
                  <el-option label="地域 (region)" value="region" />
                </el-option-group>
                <el-option-group label="常用标签（可输入任意 tag.xxx）">
                  <el-option label="环境 (tag.env)" value="tag.env" />
                  <el-option label="服务 (tag.service)" value="tag.service" />
                  <el-option label="团队 (tag.team)" value="tag.team" />
                </el-option-group>
                <el-option-group label="属性（可输入任意 attributes.xxx）">
                  <el-option label="资源组ID (attributes.project_id)" value="attributes.project_id" />
                </el-option-group>
              </el-select>
              <el-select v-model="condition.operator" placeholder="操作符" style="width: 120px">
                <el-option label="等于" value="eq" />
                <el-option label="不等于" value="ne" />
                <el-option label="包含" value="contains" />
                <el-option label="正则匹配" value="regex" />
                <el-option label="在列表中" value="in" />
                <el-option label="字段存在" value="exists" />
              </el-select>
              <el-input
                v-model="condition.value"
                placeholder="值"
                style="flex: 1"
                :disabled="condition.operator === 'exists'"
              />
              <el-button
                type="danger"
                text
                :icon="Delete"
                @click="removeCondition(index)"
              />
            </div>
            <div v-if="form.conditions.length === 0" class="empty-conditions">
              暂无条件，请点击上方按钮添加
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="启用规则">
        <el-switch v-model="form.enabled" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button :loading="dryRunning" @click="handleDryRun">试运行</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        保存
      </el-button>
    </template>
  </el-dialog>

  <!-- 试运行预览（只读，不落库） -->
  <el-dialog v-model="dryRunVisible" title="试运行预览" width="720px" append-to-body>
    <template v-if="dryRunResult">
      <el-alert
        v-if="dryRunResult.total === 0"
        type="warning"
        :closable="false"
        show-icon
        title="试运行未命中任何资产"
        description="当前条件没有匹配到任何资产，请检查字段名、操作符与值是否过严，确认后再保存。"
      />
      <div v-else class="dryrun-summary">
        共命中 <b>{{ dryRunResult.total }}</b> 台资产
        <span v-if="dryRunResult.capped" class="dryrun-capped">
          （命中较多，仅展示前 {{ dryRunResult.items.length }} 条，建议收紧条件）
        </span>
      </div>
      <el-table
        v-if="dryRunResult.items.length > 0"
        :data="dryRunResult.items"
        max-height="420"
        size="small"
      >
        <el-table-column label="资产" min-width="200">
          <template #default="{ row }">
            <div class="dryrun-asset-name">{{ row.asset_name }}</div>
            <div class="dryrun-asset-id">{{ row.asset_id }}</div>
          </template>
        </el-table-column>
        <el-table-column label="云平台" width="110">
          <template #default="{ row }">
            {{ getProviderLabel(row.provider) }}
          </template>
        </el-table-column>
        <el-table-column prop="region" label="地域" width="150" show-overflow-tooltip />
        <el-table-column label="当前绑定状态" min-width="160">
          <template #default="{ row }">
            <el-tag :type="bindStatusTagType(row.bind_status)" size="small">
              {{ bindStatusLabel(row.bind_status) }}
            </el-tag>
            <span v-if="row.bound_node_name" class="dryrun-bound-node">{{ row.bound_node_name }}</span>
          </template>
        </el-table-column>
      </el-table>
    </template>
    <template #footer>
      <el-button type="primary" @click="dryRunVisible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { createRuleApi, dryRunRulesApi, getTreeApi, listEnvironmentsApi, updateRuleApi } from '@/api/service-tree'
import type {
  BindingRule,
  DryRunResult,
  Environment,
  RuleCondition,
  ServiceTreeNode
} from '@/api/types/service-tree'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'
import { getProviderLabel } from '@/utils/constants'

const props = defineProps<{
  visible: boolean
  rule?: BindingRule
  isEdit: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const treeData = ref<ServiceTreeNode[]>([])
const environmentList = ref<Environment[]>([])

const form = reactive({
  name: '',
  nodeId: undefined as number | undefined,
  envId: undefined as number | undefined,
  priority: 10,
  description: '',
  conditions: [] as RuleCondition[],
  enabled: true
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入规则名称', trigger: 'blur' }
  ],
  nodeId: [
    { required: true, message: '请选择目标节点', trigger: 'change' }
  ],
  envId: [
    { required: true, message: '请选择目标环境', trigger: 'change' }
  ]
}

// 加载树数据
const loadTree = async () => {
  try {
    const res = await getTreeApi()
    // 如果返回的是根节点对象，将其包装成数组；否则使用 children
    if (res.data) {
      if (res.data.id) {
        // 返回的是根节点，包装成数组以便选择
        treeData.value = [res.data]
      } else if (res.data.children) {
        treeData.value = res.data.children
      } else if (Array.isArray(res.data)) {
        treeData.value = res.data
      }
    }
  } catch (error) {
    console.error('加载服务树失败:', error)
    ElMessage.error('加载服务树失败')
  }
}

// 加载环境列表
const loadEnvironments = async () => {
  try {
    const res = await listEnvironmentsApi({ status: 1 })
    environmentList.value = res.data?.list || []
  } catch (error) {
    console.error('加载环境列表失败:', error)
    ElMessage.error('加载环境列表失败')
  }
}

// 添加条件
const addCondition = () => {
  form.conditions.push({
    field: '',
    operator: 'eq',
    value: ''
  })
}

// 删除条件
const removeCondition = (index: number) => {
  form.conditions.splice(index, 1)
}

// 试运行（dry-run）状态
const dryRunning = ref(false)
const dryRunVisible = ref(false)
const dryRunResult = ref<DryRunResult | null>(null)

// 绑定状态展示元数据
const BIND_STATUS_META: Record<string, { label: string; type: 'info' | 'warning' | 'success' }> = {
  unbound: { label: '未绑定', type: 'info' },
  manual: { label: '手动绑定', type: 'warning' },
  rule: { label: '规则绑定', type: 'success' }
}
const bindStatusLabel = (status: string) => BIND_STATUS_META[status]?.label ?? status
const bindStatusTagType = (status: string) => BIND_STATUS_META[status]?.type ?? 'info'

// 校验条件完整性（试运行与保存共用）
const validateConditions = (): boolean => {
  if (form.conditions.length === 0) {
    ElMessage.warning('请至少添加一个匹配条件')
    return false
  }
  for (const condition of form.conditions) {
    if (!condition.field || !condition.operator) {
      ElMessage.warning('请完善匹配条件')
      return false
    }
    if (condition.operator !== 'exists' && !condition.value) {
      ElMessage.warning('请填写条件值')
      return false
    }
  }
  return true
}

// 试运行：按当前条件预览命中资产（只读不落库）
const handleDryRun = async () => {
  if (!validateConditions()) {
    return
  }
  dryRunning.value = true
  try {
    const res = await dryRunRulesApi({
      conditions: form.conditions,
      node_id: form.nodeId,
      env_id: form.envId
    })
    dryRunResult.value = res.data ?? { items: [], total: 0, capped: false }
    dryRunVisible.value = true
  } catch (error: any) {
    ElMessage.error(error?.message || '试运行失败')
  } finally {
    dryRunning.value = false
  }
}

// 提交
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()

    if (!validateConditions()) {
      return
    }

    submitting.value = true

    const data = {
      name: form.name,
      node_id: form.nodeId!,
      env_id: form.envId!,
      priority: form.priority,
      description: form.description || undefined,
      conditions: form.conditions,
      enabled: form.enabled
    }

    if (props.isEdit && props.rule) {
      await updateRuleApi(props.rule.id, data)
      ElMessage.success('更新成功')
    } else {
      await createRuleApi(data)
      ElMessage.success('创建成功')
    }

    emit('success')
  } catch (error: any) {
    if (error !== false) {
      ElMessage.error(error.message || '操作失败')
    }
  } finally {
    submitting.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    if (props.isEdit && props.rule) {
      form.name = props.rule.name
      form.nodeId = props.rule.node_id
      form.envId = props.rule.env_id
      form.priority = props.rule.priority
      form.description = props.rule.description || ''
      form.conditions = [...props.rule.conditions]
      form.enabled = props.rule.enabled
    } else {
      form.name = ''
      form.nodeId = undefined
      form.envId = environmentList.value[0]?.id
      form.priority = 10
      form.description = ''
      form.conditions = []
      form.enabled = true
    }
    formRef.value?.clearValidate()
  }
})

onMounted(() => {
  loadTree()
  loadEnvironments()
})
</script>

<style scoped lang="scss">
.env-option {
  display: flex;
  align-items: center;
  gap: 8px;

  .env-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
}

.form-tip {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.conditions-section {
  width: 100%;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  overflow: hidden;

  .conditions-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: var(--bg-hover);
    border-bottom: 1px solid var(--border-subtle);

    .hint {
      font-size: 13px;
      color: var(--text-tertiary);
    }
  }

  .conditions-list {
    padding: 12px;

    .condition-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .empty-conditions {
      padding: 24px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
  }
}

.dryrun-summary {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary);

  .dryrun-capped {
    margin-left: 8px;
    color: var(--el-color-warning, #e6a23c);
  }
}

.dryrun-asset-name {
  font-size: 13px;
}

.dryrun-asset-id {
  font-size: 12px;
  color: var(--text-tertiary);
}

.dryrun-bound-node {
  margin-left: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
