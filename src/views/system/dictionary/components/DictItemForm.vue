<template>
  <el-dialog
    :model-value="visible"
    :title="editData ? '编辑字典项' : '新增字典项'"
    width="500px"
    destroy-on-close
    @close="$emit('update:visible', false)"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="dict-form">
      <el-form-item label="值" prop="value">
        <el-input
          v-model="form.value"
          :disabled="!!editData"
          placeholder="字典项的唯一标识值"
        />
        <div v-if="!editData" class="form-hint">值创建后不可修改</div>
      </el-form-item>
      <el-form-item label="标签" prop="label">
        <el-input v-model="form.label" placeholder="显示名称" />
      </el-form-item>
      <div class="form-row">
        <el-form-item label="排序" prop="sort_order" class="form-row-item">
          <el-input-number v-model="form.sort_order" :min="0" controls-position="right" style="width: 100%" />
        </el-form-item>
      </div>
      <el-form-item label="扩展数据" prop="extra">
        <el-input
          v-model="form.extraStr"
          type="textarea"
          :rows="3"
          placeholder='可选，JSON 格式，如 {"color":"#3b82f6"}'
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
import type { CreateDictItemReq, DictItem, UpdateDictItemReq } from '@/api/types/dictionary';
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage } from 'element-plus';
import { ref, watch } from 'vue';

const props = defineProps<{
  visible: boolean
  editData: DictItem | null
}>()

const emit = defineEmits<{
  'update:visible': [val: boolean]
  submit: [data: CreateDictItemReq | UpdateDictItemReq]
}>()

const formRef = ref<FormInstance>()
const form = ref<{ value: string; label: string; sort_order: number; extraStr: string }>({
  value: '',
  label: '',
  sort_order: 0,
  extraStr: ''
})

const rules: FormRules = {
  value: [{ required: true, message: '请输入值', trigger: 'blur' }],
  label: [{ required: true, message: '请输入标签', trigger: 'blur' }]
}

watch(() => props.visible, (val) => {
  if (val && props.editData) {
    form.value = {
      value: props.editData.value,
      label: props.editData.label,
      sort_order: props.editData.sort_order || 0,
      extraStr: props.editData.extra ? JSON.stringify(props.editData.extra) : ''
    }
  } else if (val) {
    form.value = { value: '', label: '', sort_order: 0, extraStr: '' }
  }
})

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate()

  let extra: Record<string, unknown> | undefined
  if (form.value.extraStr.trim()) {
    try {
      extra = JSON.parse(form.value.extraStr) as Record<string, unknown>
    } catch {
      ElMessage.error('扩展字段 JSON 格式不正确')
      return
    }
  }

  if (props.editData) {
    emit('submit', {
      label: form.value.label,
      sort_order: form.value.sort_order,
      extra
    } as UpdateDictItemReq)
  } else {
    emit('submit', {
      value: form.value.value,
      label: form.value.label,
      sort_order: form.value.sort_order,
      extra
    } as CreateDictItemReq)
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

.form-row {
  display: flex;
  gap: 16px;
}

.form-row-item {
  flex: 1;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
