<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
    <el-form-item label="关系UID" prop="uid">
      <el-input v-model="form.uid" placeholder="如 ecs_belongs_to_vpc" :disabled="isEdit" />
    </el-form-item>

    <el-form-item label="关系名称" prop="name">
      <el-input v-model="form.name" placeholder="如 ECS属于VPC" />
    </el-form-item>

    <el-form-item label="源模型" prop="source_uid">
      <el-select v-model="form.source_uid" placeholder="请选择源模型" filterable :disabled="isEdit" style="width: 100%">
        <el-option v-for="m in models" :key="m.uid" :label="`${m.name} (${m.uid})`" :value="m.uid" />
      </el-select>
    </el-form-item>

    <el-form-item label="目标模型" prop="target_uid">
      <el-select v-model="form.target_uid" placeholder="请选择目标模型" filterable :disabled="isEdit" style="width: 100%">
        <el-option v-for="m in models" :key="m.uid" :label="`${m.name} (${m.uid})`" :value="m.uid" />
      </el-select>
    </el-form-item>

    <el-form-item label="关系类型" prop="relation_type">
      <el-select v-model="form.relation_type" placeholder="请选择关系类型" :disabled="isEdit" style="width: 100%">
        <el-option label="归属 (belongs_to)" value="belongs_to" />
        <el-option label="包含 (contains)" value="contains" />
        <el-option label="绑定 (bindto)" value="bindto" />
        <el-option label="连接 (connects)" value="connects" />
        <el-option label="依赖 (depends_on)" value="depends_on" />
      </el-select>
    </el-form-item>

    <el-form-item label="方向" prop="direction">
      <el-select v-model="form.direction" placeholder="请选择方向" style="width: 100%">
        <el-option label="一对一" value="one_to_one" />
        <el-option label="一对多" value="one_to_many" />
        <el-option label="多对一" value="many_to_one" />
        <el-option label="多对多" value="many_to_many" />
      </el-select>
    </el-form-item>

    <el-form-item label="源→目标描述" prop="source_to_target">
      <el-input v-model="form.source_to_target" placeholder="如：属于" />
    </el-form-item>

    <el-form-item label="目标→源描述" prop="target_to_source">
      <el-input v-model="form.target_to_source" placeholder="如：包含" />
    </el-form-item>

    <el-form-item label="描述" prop="description">
      <el-input v-model="form.description" type="textarea" :rows="2" placeholder="关系描述（可选）" />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { createModelRelationApi, updateModelRelationApi } from '@/api';
import type { ModelRelationVO, ModelVO, RelationDirection, RelationType } from '@/api/types/cmdb';
import type { FormInstance, FormRules } from 'element-plus';
import { reactive, ref, watch } from 'vue';

const props = defineProps<{
  relation: ModelRelationVO | null
  isEdit: boolean
  models: ModelVO[]
}>()

const formRef = ref<FormInstance>()

const form = reactive({
  uid: '',
  name: '',
  source_uid: '',
  target_uid: '',
  relation_type: 'belongs_to' as RelationType,
  direction: 'one_to_many' as RelationDirection,
  source_to_target: '',
  target_to_source: '',
  description: '',
})

const rules: FormRules = {
  uid: [{ required: true, message: '请输入关系UID', trigger: 'blur' }],
  name: [{ required: true, message: '请输入关系名称', trigger: 'blur' }],
  source_uid: [{ required: true, message: '请选择源模型', trigger: 'change' }],
  target_uid: [{ required: true, message: '请选择目标模型', trigger: 'change' }],
  relation_type: [{ required: true, message: '请选择关系类型', trigger: 'change' }],
}

watch(() => props.relation, (val) => {
  if (val) {
    form.uid = val.uid
    form.name = val.name
    form.source_uid = val.source_uid
    form.target_uid = val.target_uid
    form.relation_type = val.relation_type as RelationType
    form.direction = (val.direction || 'one_to_many') as RelationDirection
    form.source_to_target = val.source_to_target || ''
    form.target_to_source = val.target_to_source || ''
    form.description = val.description || ''
  } else {
    reset()
  }
}, { immediate: true })

const submit = async () => {
  await formRef.value?.validate()
  if (props.isEdit && props.relation) {
    await updateModelRelationApi(props.relation.uid, {
      name: form.name,
      source_to_target: form.source_to_target || undefined,
      target_to_source: form.target_to_source || undefined,
      description: form.description || undefined,
    })
  } else {
    await createModelRelationApi({
      uid: form.uid,
      name: form.name,
      source_uid: form.source_uid,
      target_uid: form.target_uid,
      relation_type: form.relation_type,
      direction: form.direction,
      source_to_target: form.source_to_target || undefined,
      target_to_source: form.target_to_source || undefined,
      description: form.description || undefined,
    })
  }
}

const reset = () => {
  form.uid = ''
  form.name = ''
  form.source_uid = ''
  form.target_uid = ''
  form.relation_type = 'belongs_to'
  form.direction = 'one_to_many'
  form.source_to_target = ''
  form.target_to_source = ''
  form.description = ''
  formRef.value?.resetFields()
}

defineExpose({ submit, reset })
</script>
