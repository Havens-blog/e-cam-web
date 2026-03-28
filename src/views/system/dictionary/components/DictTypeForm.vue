<template>
  <el-dialog
    :model-value="visible"
    :title="editData ? '编辑字典类型' : '新增字典类型'"
    width="500px"
    destroy-on-close
    @close="$emit('update:visible', false)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="dict-form">
      <el-form-item label="编码" prop="code">
        <el-input
          v-model="form.code"
          :disabled="!!editData"
          placeholder="字母、数字、下划线，如 region_type"
        />
        <div class="form-hint">编码创建后不可修改，请谨慎填写</div>
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入字典类型名称" />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="可选，描述该字典类型的用途"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:visible', false)">取消</el-button>
        <el-button type="primary" @click="handleSubmit">
          {{ editData ? '保存' : '创建' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { CreateDictTypeReq, DictType, UpdateDictTypeReq } from '@/api/types/dictionary';
import type { FormInstance, FormRules } from 'element-plus';
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean
  editData: DictType | null
}>()

const emit = defineEmits<{
  'update:visible': [val: boolean]
  submit: [data: CreateDictTypeReq | UpdateDictTypeReq]
}>()

const formRef = ref<FormInstance>()
const form = ref<{ code: string; name: string; description: string }>({
  code: '',
  name: '',
  description: ''
})

const rules: FormRules = {
  code: [
    { required: true, message: '请输入编码', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '仅支持字母、数字、下划线', trigger: 'blur' }
  ],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }]
}

watch(() => props.visible, (val) => {
  if (val && props.editData) {
    form.value = {
      code: props.editData.code,
      name: props.editData.name,
      description: props.editData.description || ''
    }
  } else if (val) {
    form.value = { code: '', name: '', description: '' }
  }
})

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()
  if (props.editData) {
    emit('submit', { name: form.value.name, description: form.value.description } as UpdateDictTypeReq)
  } else {
    emit('submit', {
      code: form.value.code,
      name: form.value.name,
      description: form.value.description
    } as CreateDictTypeReq)
  }
}
</script>

<style lang="scss" scoped>
.dict-form {
  :deep(.el-form-item__label) {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    padding-bottom: 6px;
  }
}

.form-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
