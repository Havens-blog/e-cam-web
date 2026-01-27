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
            <span class="hint">满足所有条件时触发绑定</span>
            <el-button type="primary" text size="small" @click="addCondition">
              <el-icon><Plus /></el-icon>
              添加条件
            </el-button>
          </div>
          <div class="conditions-list">
            <div v-for="(condition, index) in form.conditions" :key="index" class="condition-item">
              <el-select v-model="condition.field" placeholder="字段" style="width: 160px">
                <el-option-group label="基础字段">
                  <el-option label="资源名称" value="name" />
                  <el-option label="资产ID" value="asset_id" />
                  <el-option label="模型UID" value="model_uid" />
                  <el-option label="地域" value="region" />
                </el-option-group>
                <el-option-group label="标签">
                  <el-option label="tag.env" value="tag.env" />
                  <el-option label="tag.service" value="tag.service" />
                  <el-option label="tag.team" value="tag.team" />
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
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { createRuleApi, getTreeApi, updateRuleApi } from '@/api/service-tree'
import type { BindingRule, RuleCondition, ServiceTreeNode } from '@/api/types/service-tree'
import { Delete, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'

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

const form = reactive({
  name: '',
  nodeId: undefined as number | undefined,
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
  ]
}

// 加载树数据
const loadTree = async () => {
  try {
    const res = await getTreeApi()
    treeData.value = res.data?.children || []
  } catch (error) {
    console.error('加载服务树失败:', error)
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

// 提交
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()

    if (form.conditions.length === 0) {
      ElMessage.warning('请至少添加一个匹配条件')
      return
    }

    // 验证条件完整性
    for (const condition of form.conditions) {
      if (!condition.field || !condition.operator) {
        ElMessage.warning('请完善匹配条件')
        return
      }
      if (condition.operator !== 'exists' && !condition.value) {
        ElMessage.warning('请填写条件值')
        return
      }
    }

    submitting.value = true

    const data = {
      name: form.name,
      node_id: form.nodeId!,
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
      form.priority = props.rule.priority
      form.description = props.rule.description || ''
      form.conditions = [...props.rule.conditions]
      form.enabled = props.rule.enabled
    } else {
      form.name = ''
      form.nodeId = undefined
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
})
</script>

<style scoped lang="scss">
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
</style>
