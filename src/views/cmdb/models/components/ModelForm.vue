<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="model-form">
    <el-form-item label="模型UID" prop="uid">
      <el-input
        v-model="form.uid"
        placeholder="唯一标识，如 aliyun_ecs"
        :disabled="isEdit"
      />
    </el-form-item>

    <el-form-item label="模型名称" prop="name">
      <el-input v-model="form.name" placeholder="模型名称，如 阿里云ECS" />
    </el-form-item>

    <el-form-item label="类别" prop="category">
      <el-select v-model="form.category" placeholder="请选择类别" style="width: 100%">
        <el-option label="计算" value="compute" />
        <el-option label="存储" value="storage" />
        <el-option label="网络" value="network" />
        <el-option label="数据库" value="database" />
        <el-option label="安全" value="security" />
        <el-option label="IAM" value="iam" />
      </el-select>
    </el-form-item>

    <el-form-item label="云厂商" prop="provider">
      <el-select v-model="form.provider" placeholder="请选择云厂商" style="width: 100%">
        <el-option label="阿里云" value="aliyun" />
        <el-option label="AWS" value="aws" />
        <el-option label="Azure" value="azure" />
        <el-option label="通用" value="all" />
      </el-select>
    </el-form-item>

    <el-form-item label="层级" prop="level">
      <el-radio-group v-model="form.level">
        <el-radio :value="1">主资源</el-radio>
        <el-radio :value="2">子资源</el-radio>
      </el-radio-group>
    </el-form-item>

    <el-form-item v-if="form.level === 2" label="父模型UID" prop="parent_uid">
      <el-input v-model="form.parent_uid" placeholder="父模型UID" />
    </el-form-item>

    <el-form-item label="分组" prop="model_group_id">
      <el-select
        v-model="form.model_group_id"
        placeholder="请选择分组"
        style="width: 100%"
        clearable
      >
        <el-option
          v-for="group in groups"
          :key="group.id"
          :label="group.name"
          :value="group.id"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="图标" prop="icon">
      <el-input v-model="form.icon" placeholder="图标名称（可选）" />
    </el-form-item>

    <el-form-item label="描述" prop="description">
      <el-input
        v-model="form.description"
        type="textarea"
        :rows="3"
        placeholder="模型描述（可选）"
      />
    </el-form-item>

    <el-form-item label="可扩展" prop="extensible">
      <el-switch v-model="form.extensible" />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { createCmdbModelApi, updateCmdbModelApi } from '@/api';
import type { ModelCategory, ModelProvider, ModelVO } from '@/api/types/cmdb';
import type { FormInstance, FormRules } from 'element-plus';
import { reactive, ref, watch } from 'vue';

const props = defineProps<{
  model: ModelVO | null
  isEdit: boolean
  groups?: { id: number; name: string }[]
}>()

const formRef = ref<FormInstance>()

const form = reactive({
  uid: '',
  name: '',
  category: 'compute' as ModelCategory,
  provider: 'aliyun' as ModelProvider,
  level: 1,
  parent_uid: '',
  model_group_id: undefined as number | undefined,
  icon: '',
  description: '',
  extensible: true,
})

const rules: FormRules = {
  uid: [
    { required: true, message: '请输入模型UID', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_]*$/, message: 'UID只能包含小写字母、数字和下划线，且以字母开头', trigger: 'blur' }
  ],
  name: [{ required: true, message: '请输入模型名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择类别', trigger: 'change' }],
}

// 监听模型变化，填充表单
watch(
  () => props.model,
  (val) => {
    if (val) {
      form.uid = val.uid
      form.name = val.name
      form.category = val.category as ModelCategory
      form.provider = (val.provider || 'aliyun') as ModelProvider
      form.level = val.level || 1
      form.parent_uid = val.parent_uid || ''
      form.model_group_id = val.model_group_id
      form.icon = val.icon || ''
      form.description = val.description || ''
      form.extensible = val.extensible !== false
    } else {
      reset()
    }
  },
  { immediate: true }
)

const submit = async () => {
  await formRef.value?.validate()

  if (props.isEdit && props.model) {
    await updateCmdbModelApi(props.model.uid, {
      name: form.name,
      model_group_id: form.model_group_id,
      icon: form.icon || undefined,
      description: form.description || undefined,
      extensible: form.extensible,
    })
  } else {
    await createCmdbModelApi({
      uid: form.uid,
      name: form.name,
      category: form.category,
      provider: form.provider,
      level: form.level,
      parent_uid: form.level === 2 ? form.parent_uid : undefined,
      model_group_id: form.model_group_id,
      icon: form.icon || undefined,
      description: form.description || undefined,
      extensible: form.extensible,
    })
  }
}

const reset = () => {
  form.uid = ''
  form.name = ''
  form.category = 'compute'
  form.provider = 'aliyun'
  form.level = 1
  form.parent_uid = ''
  form.model_group_id = undefined
  form.icon = ''
  form.description = ''
  form.extensible = true
  formRef.value?.resetFields()
}

defineExpose({ submit, reset })
</script>

<style scoped lang="scss">
.model-form {
  :deep(.el-form-item__label) {
    color: var(--text-secondary);
  }
}
</style>
