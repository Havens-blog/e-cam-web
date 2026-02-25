<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑通知渠道' : '新建通知渠道'"
    width="560px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="right">
      <el-form-item label="渠道名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入渠道名称" />
      </el-form-item>
      <el-form-item label="渠道类型" prop="type">
        <el-select v-model="form.type" placeholder="请选择渠道类型" :disabled="isEdit" style="width: 100%" @change="handleTypeChange">
          <el-option label="钉钉" value="dingtalk" />
          <el-option label="企业微信" value="wecom" />
          <el-option label="飞书" value="feishu" />
          <el-option label="邮件" value="email" />
        </el-select>
      </el-form-item>

      <!-- 钉钉/企微/飞书 -->
      <template v-if="form.type === 'dingtalk' || form.type === 'wecom' || form.type === 'feishu'">
        <el-form-item label="Webhook" prop="config.webhook">
          <el-input v-model="form.config.webhook" placeholder="请输入 Webhook 地址" />
        </el-form-item>
        <el-form-item v-if="form.type !== 'wecom'" label="签名密钥">
          <el-input v-model="form.config.secret" placeholder="选填，加签密钥" />
        </el-form-item>
      </template>

      <!-- 邮件 -->
      <template v-if="form.type === 'email'">
        <el-form-item label="SMTP 主机" prop="config.smtp_host">
          <el-input v-model="form.config.smtp_host" placeholder="smtp.example.com" />
        </el-form-item>
        <el-form-item label="SMTP 端口" prop="config.smtp_port">
          <el-input-number v-model="form.config.smtp_port" :min="1" :max="65535" style="width: 100%" />
        </el-form-item>
        <el-form-item label="用户名" prop="config.smtp_user">
          <el-input v-model="form.config.smtp_user" placeholder="发件人邮箱" />
        </el-form-item>
        <el-form-item label="密码" prop="config.smtp_pass">
          <el-input v-model="form.config.smtp_pass" type="password" show-password placeholder="SMTP 密码" />
        </el-form-item>
        <el-form-item label="发件人" prop="config.from">
          <el-input v-model="form.config.from" placeholder="发件人地址" />
        </el-form-item>
        <el-form-item label="收件人" prop="config.to">
          <el-select
            v-model="form.config.to"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入邮箱后回车添加"
            style="width: 100%"
          />
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { AlertChannel, ChannelType } from '@/api/alert'
import { createChannelApi, updateChannelApi } from '@/api/alert'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  editData?: AlertChannel | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  'success': []
}>()

const visible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()

const defaultForm = () => ({
  name: '',
  type: 'dingtalk' as ChannelType,
  config: {
    webhook: '',
    secret: '',
    smtp_host: '',
    smtp_port: 465,
    smtp_user: '',
    smtp_pass: '',
    from: '',
    to: [] as string[],
  } as Record<string, any>,
})

const form = reactive(defaultForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择渠道类型', trigger: 'change' }],
  'config.webhook': [{ required: true, message: '请输入 Webhook 地址', trigger: 'blur' }],
  'config.smtp_host': [{ required: true, message: '请输入 SMTP 主机', trigger: 'blur' }],
  'config.smtp_user': [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  'config.smtp_pass': [{ required: true, message: '请输入密码', trigger: 'blur' }],
  'config.from': [{ required: true, message: '请输入发件人', trigger: 'blur' }],
}

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    if (props.editData) {
      isEdit.value = true
      form.name = props.editData.name
      form.type = props.editData.type
      form.config = { ...defaultForm().config, ...props.editData.config }
    } else {
      isEdit.value = false
      Object.assign(form, defaultForm())
    }
  }
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

const handleTypeChange = () => {
  form.config = defaultForm().config
}

const handleClose = () => {
  visible.value = false
  formRef.value?.resetFields()
}

const buildConfig = () => {
  const t = form.type
  if (t === 'dingtalk' || t === 'feishu') {
    const c: Record<string, any> = { webhook: form.config.webhook }
    if (form.config.secret) c.secret = form.config.secret
    return c
  }
  if (t === 'wecom') return { webhook: form.config.webhook }
  if (t === 'email') {
    return {
      smtp_host: form.config.smtp_host,
      smtp_port: form.config.smtp_port,
      smtp_user: form.config.smtp_user,
      smtp_pass: form.config.smtp_pass,
      from: form.config.from,
      to: form.config.to,
    }
  }
  return {}
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch { return }

  submitting.value = true
  try {
    const payload = { name: form.name, type: form.type, config: buildConfig() }
    if (isEdit.value && props.editData) {
      await updateChannelApi(props.editData.id, payload)
      ElMessage.success('更新成功')
    } else {
      await createChannelApi(payload)
      ElMessage.success('创建成功')
    }
    handleClose()
    emit('success')
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}
</script>
