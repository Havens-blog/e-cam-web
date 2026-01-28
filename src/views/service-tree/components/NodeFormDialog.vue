<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑节点' : '新建节点'"
    width="520px"
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
      <el-form-item label="节点名称" prop="name">
        <el-input v-model="form.name" placeholder="如: 订单服务" maxlength="64" />
      </el-form-item>
      <el-form-item label="节点UID" prop="uid">
        <el-input v-model="form.uid" placeholder="如: ecommerce.mall.order（可选）" maxlength="128" />
        <div class="form-tip">建议使用点分格式，便于标识和搜索</div>
      </el-form-item>
      <el-form-item label="负责人" prop="owner">
        <el-input v-model="form.owner" placeholder="负责人姓名（可选）" maxlength="64" />
      </el-form-item>
      <el-form-item label="所属团队" prop="team">
        <el-input v-model="form.team" placeholder="团队名称（可选）" maxlength="64" />
      </el-form-item>
      <el-form-item label="标签" prop="tags">
        <el-select
          v-model="form.tags"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="输入后回车添加标签"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="节点描述（可选）"
          maxlength="512"
        />
      </el-form-item>
      <el-form-item label="排序" prop="order">
        <el-input-number v-model="form.order" :min="1" :max="999" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { createNodeApi, updateNodeApi } from '@/api/service-tree'
import type { ServiceTreeNode } from '@/api/types/service-tree'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  node?: ServiceTreeNode
  parentId: number
  parentLevel: number  // 父节点层级，根节点时为0
  isEdit: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  name: '',
  uid: '',
  owner: '',
  team: '',
  tags: [] as string[],
  description: '',
  order: 1
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入节点名称', trigger: 'blur' }
  ],
  uid: [
    { pattern: /^[a-z][a-z0-9._-]*$/, message: '只能包含小写字母、数字、点、下划线和连字符', trigger: 'blur' }
  ]
}

watch(() => props.visible, (val) => {
  if (val) {
    if (props.isEdit && props.node) {
      form.name = props.node.name
      form.uid = props.node.uid || ''
      form.owner = props.node.owner || ''
      form.team = props.node.team || ''
      form.tags = props.node.tags || []
      form.description = props.node.description || ''
      form.order = props.node.order || 1
    } else {
      form.name = ''
      form.uid = ''
      form.owner = ''
      form.team = ''
      form.tags = []
      form.description = ''
      form.order = 1
    }
    formRef.value?.clearValidate()
  }
})

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true

    // 计算层级：父节点层级 + 1，根节点层级为1
    const level = props.isEdit ? props.node?.level : (props.parentLevel + 1)

    const data = {
      name: form.name,
      uid: form.uid || undefined,
      parent_id: props.isEdit ? undefined : props.parentId,
      level: props.isEdit ? undefined : level,
      owner: form.owner || undefined,
      team: form.team || undefined,
      tags: form.tags.length > 0 ? form.tags : undefined,
      description: form.description || undefined,
      order: form.order
    }

    if (props.isEdit && props.node) {
      await updateNodeApi(props.node.id, data)
      ElMessage.success('更新成功')
    } else {
      await createNodeApi(data)
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
</script>

<style scoped lang="scss">
.form-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
