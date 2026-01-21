<template>
  <el-form ref="formRef" :model="formData" :rules="rules" label-width="120px">
    <el-form-item label="权限组名称" prop="name">
      <el-input
        v-model="formData.name"
        placeholder="请输入权限组名称"
        maxlength="100"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="描述" prop="description">
      <el-input
        v-model="formData.description"
        type="textarea"
        :rows="3"
        placeholder="请输入权限组描述"
        maxlength="500"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="云平台" prop="cloud_platforms">
      <el-select
        v-model="formData.cloud_platforms"
        multiple
        placeholder="请选择云平台"
        style="width: 100%"
      >
        <el-option
          v-for="p in CLOUD_PROVIDERS"
          :key="p.value"
          :label="p.label"
          :value="p.value"
        />
      </el-select>
      <div class="form-tip">可以选择多个云平台,该权限组将应用于所选平台</div>
    </el-form-item>

    <el-form-item label="权限策略" prop="policies">
      <PolicyEditor
        v-model:policies="formData.policies"
        :providers="formData.cloud_platforms"
      />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { createGroupApi, updateGroupApi } from '@/api'
import type { PermissionGroup, PermissionPolicy } from '@/api/types/iam'
import { CLOUD_PROVIDERS } from '@/utils/constants'
import type { FormInstance, FormRules } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import PolicyEditor from './PolicyEditor.vue'

interface Props {
  group?: PermissionGroup | null
  isEdit: boolean
}

const props = defineProps<Props>()

const formRef = ref<FormInstance>()

const formData = reactive<{
  name: string
  description: string
  cloud_platforms: any[]
  policies: PermissionPolicy[]
  tenant_id: string
}>({
  name: '',
  description: '',
  cloud_platforms: [],
  policies: [],
  tenant_id: 'default'
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入权限组名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' }
  ],
  cloud_platforms: [
    { required: true, message: '请选择至少一个云平台', trigger: 'change', type: 'array', min: 1 }
  ]
}

// 初始化表单数据
const initFormData = () => {
  if (props.group) {
    formData.name = props.group.name
    formData.description = props.group.description
    formData.cloud_platforms = [...props.group.cloud_platforms]
    formData.policies = props.group.policies ? [...props.group.policies] : []
    formData.tenant_id = props.group.tenant_id
  }
}

// 提交表单
const submit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  if (props.isEdit && props.group) {
    await updateGroupApi(props.group.id, {
      name: formData.name,
      description: formData.description,
      cloud_platforms: formData.cloud_platforms,
      policies: formData.policies
    })
  } else {
    await createGroupApi({
      name: formData.name,
      description: formData.description,
      cloud_platforms: formData.cloud_platforms,
      policies: formData.policies,
      tenant_id: formData.tenant_id
    })
  }
}

// 重置表单
const reset = () => {
  formRef.value?.resetFields()
  formData.name = ''
  formData.description = ''
  formData.cloud_platforms = []
  formData.policies = []
  formData.tenant_id = 'default'
}

// 暴露方法
defineExpose({
  submit,
  reset
})

// 初始化
onMounted(() => {
  initFormData()
})
</script>

<style scoped lang="scss">
.form-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}
</style>
