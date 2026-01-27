<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑环境' : '新建环境'"
    width="480px"
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
      <el-form-item label="环境代码" prop="code">
        <el-input
          v-model="form.code"
          placeholder="如: dev, test, prod"
          :disabled="isEdit"
          maxlength="32"
        />
      </el-form-item>
      <el-form-item label="环境名称" prop="name">
        <el-input v-model="form.name" placeholder="如: 开发环境" maxlength="64" />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          placeholder="环境描述（可选）"
          maxlength="256"
        />
      </el-form-item>
      <el-form-item label="颜色" prop="color">
        <div class="color-picker-wrapper">
          <el-color-picker v-model="form.color" show-alpha />
          <div class="preset-colors">
            <span
              v-for="color in presetColors"
              :key="color"
              class="preset-color"
              :style="{ background: color }"
              :class="{ active: form.color === color }"
              @click="form.color = color"
            ></span>
          </div>
        </div>
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
import { createEnvironmentApi, updateEnvironmentApi } from '@/api/service-tree'
import type { Environment } from '@/api/types/service-tree'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  environment?: Environment
  isEdit: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

// 预设颜色
const presetColors = [
  '#52c41a', // 绿色 - dev
  '#1890ff', // 蓝色 - test
  '#faad14', // 橙色 - staging
  '#f5222d', // 红色 - prod
  '#722ed1', // 紫色
  '#13c2c2', // 青色
  '#eb2f96', // 粉色
  '#fa8c16'  // 橙黄
]

const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  code: '',
  name: '',
  description: '',
  color: '#52c41a',
  order: 1
})

const rules: FormRules = {
  code: [
    { required: true, message: '请输入环境代码', trigger: 'blur' },
    { pattern: /^[a-z][a-z0-9_-]*$/, message: '只能包含小写字母、数字、下划线和连字符，且以字母开头', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入环境名称', trigger: 'blur' }
  ],
  color: [
    { required: true, message: '请选择颜色', trigger: 'change' }
  ]
}

// 监听弹窗打开，初始化表单
watch(() => props.visible, (val) => {
  if (val) {
    if (props.isEdit && props.environment) {
      form.code = props.environment.code
      form.name = props.environment.name
      form.description = props.environment.description || ''
      form.color = props.environment.color
      form.order = props.environment.order
    } else {
      form.code = ''
      form.name = ''
      form.description = ''
      form.color = '#52c41a'
      form.order = 1
    }
    formRef.value?.clearValidate()
  }
})

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true

    const data = {
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      color: form.color,
      order: form.order
    }

    if (props.isEdit && props.environment) {
      await updateEnvironmentApi(props.environment.id, data)
      ElMessage.success('更新成功')
    } else {
      await createEnvironmentApi(data)
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
.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;

  .preset-colors {
    display: flex;
    gap: 8px;

    .preset-color {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 200ms ease;

      &:hover {
        transform: scale(1.1);
      }

      &.active {
        border-color: var(--text-primary);
      }
    }
  }
}
</style>
