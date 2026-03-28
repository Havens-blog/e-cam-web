<template>
  <el-dialog
    :model-value="visible"
    title="基于模板创建云主机"
    width="480px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="模板">
        <span>{{ templateData?.name || '-' }}</span>
      </el-form-item>
      <el-form-item label="云厂商">
        <span>{{ templateData?.provider || '-' }}</span>
      </el-form-item>
      <el-form-item label="地域">
        <span>{{ templateData?.region || '-' }}</span>
      </el-form-item>
      <el-form-item label="实例规格">
        <span>{{ templateData?.instance_type || '-' }}</span>
      </el-form-item>
      <el-divider />
      <el-form-item label="创建数量" prop="count">
        <el-input-number v-model="form.count" :min="1" :max="20" />
      </el-form-item>
      <el-form-item label="实例名称前缀">
        <el-input v-model="form.instance_name_prefix" placeholder="留空则使用模板默认值" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确认创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { provisionFromTemplateApi } from '@/api/template'
import type { VMTemplate } from '@/api/types/template'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'

const props = defineProps<{
  visible: boolean
  templateData: VMTemplate | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  count: 1,
  instance_name_prefix: ''
})

const rules: FormRules = {
  count: [{ required: true, message: '请输入创建数量', trigger: 'blur' }]
}

function handleClose() {
  emit('update:visible', false)
  form.count = 1
  form.instance_name_prefix = ''
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (!props.templateData?.id) {
    ElMessage.error('模板数据异常')
    return
  }

  submitting.value = true
  try {
    await provisionFromTemplateApi(props.templateData.id, {
      count: form.count,
      instance_name_prefix: form.instance_name_prefix || undefined
    })
    emit('success')
    handleClose()
  } catch {
    ElMessage.error('提交创建任务失败')
  } finally {
    submitting.value = false
  }
}
</script>
