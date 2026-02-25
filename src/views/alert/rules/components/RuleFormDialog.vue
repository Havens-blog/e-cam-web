<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑告警规则' : '新建告警规则'"
    width="620px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="right">
      <el-form-item label="规则名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入规则名称" />
      </el-form-item>
      <el-form-item label="告警类型" prop="type">
        <el-select v-model="form.type" placeholder="请选择告警类型" style="width: 100%">
          <el-option label="资源变更" value="resource_change" />
          <el-option label="同步失败" value="sync_failure" />
          <el-option label="资源过期提醒" value="expiration" />
          <el-option label="安全组变更" value="security_group" />
        </el-select>
      </el-form-item>
      <el-form-item label="通知渠道" prop="channel_ids">
        <el-select v-model="form.channel_ids" multiple placeholder="请选择通知渠道" style="width: 100%">
          <el-option v-for="ch in channelOptions" :key="ch.id" :label="ch.name" :value="ch.id">
            <span>{{ ch.name }}</span>
            <el-tag size="small" style="margin-left: 8px" :type="channelTagType(ch.type)">{{ channelTypeLabel(ch.type) }}</el-tag>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="资源类型">
        <el-select v-model="form.resource_types" multiple placeholder="全部资源类型" style="width: 100%">
          <el-option v-for="rt in resourceTypeOptions" :key="rt.value" :label="rt.label" :value="rt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="地域">
        <el-select v-model="form.regions" multiple filterable allow-create placeholder="全部地域（输入后回车添加）" style="width: 100%" />
      </el-form-item>
      <el-form-item label="静默期(分钟)">
        <el-input-number v-model="form.silence_duration" :min="0" :max="1440" style="width: 200px" />
      </el-form-item>
      <el-form-item label="升级阈值">
        <el-input-number v-model="form.escalate_after" :min="0" :max="100" style="width: 200px" />
        <span style="margin-left: 8px; color: #909399; font-size: 12px">连续触发N次后升级通知</span>
      </el-form-item>
      <el-form-item label="升级渠道">
        <el-select v-model="form.escalate_channels" multiple placeholder="选择升级后使用的渠道" style="width: 100%">
          <el-option v-for="ch in channelOptions" :key="ch.id" :label="ch.name" :value="ch.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { AlertChannel, AlertRule } from '@/api/alert'
import { createRuleApi, listChannelsApi, updateRuleApi } from '@/api/alert'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  editData?: AlertRule | null
}>()
const emit = defineEmits<{ 'update:modelValue': [val: boolean]; success: [] }>()

const visible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const channelOptions = ref<AlertChannel[]>([])

const resourceTypeOptions = [
  { label: 'ECS 虚拟机', value: 'ecs' },
  { label: 'RDS 数据库', value: 'rds' },
  { label: 'Redis', value: 'redis' },
  { label: 'MongoDB', value: 'mongodb' },
  { label: 'VPC', value: 'vpc' },
  { label: 'EIP', value: 'eip' },
  { label: 'NAS', value: 'nas' },
  { label: 'OSS', value: 'oss' },
  { label: 'Kafka', value: 'kafka' },
  { label: 'Elasticsearch', value: 'elasticsearch' },
]

const channelTypeLabel = (t: string) => {
  const m: Record<string, string> = { dingtalk: '钉钉', wecom: '企微', feishu: '飞书', email: '邮件' }
  return m[t] || t
}
const channelTagType = (t: string) => {
  const m: Record<string, string> = { dingtalk: '', wecom: 'success', feishu: 'warning', email: 'info' }
  return (m[t] || '') as any
}

const defaultForm = () => ({
  name: '',
  type: 'resource_change' as string,
  channel_ids: [] as number[],
  account_ids: [] as number[],
  resource_types: [] as string[],
  regions: [] as string[],
  silence_duration: 30,
  escalate_after: 3,
  escalate_channels: [] as number[],
})

const form = reactive(defaultForm())
const rules: FormRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择告警类型', trigger: 'change' }],
  channel_ids: [{ required: true, type: 'array', min: 1, message: '请选择至少一个通知渠道', trigger: 'change' }],
}

const loadChannels = async () => {
  try {
    const res = await listChannelsApi({ limit: 100 })
    channelOptions.value = (res as any).data?.items || []
  } catch { /* ignore */ }
}

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) {
    loadChannels()
    if (props.editData) {
      isEdit.value = true
      Object.assign(form, {
        name: props.editData.name,
        type: props.editData.type,
        channel_ids: [...props.editData.channel_ids],
        account_ids: [...(props.editData.account_ids || [])],
        resource_types: [...(props.editData.resource_types || [])],
        regions: [...(props.editData.regions || [])],
        silence_duration: props.editData.silence_duration || 30,
        escalate_after: props.editData.escalate_after || 3,
        escalate_channels: [...(props.editData.escalate_channels || [])],
      })
    } else {
      isEdit.value = false
      Object.assign(form, defaultForm())
    }
  }
})
watch(visible, (val) => emit('update:modelValue', val))

const handleClose = () => { visible.value = false; formRef.value?.resetFields() }

const handleSubmit = async () => {
  try { await formRef.value?.validate() } catch { return }
  submitting.value = true
  try {
    const payload = { ...form } as any
    if (isEdit.value && props.editData) {
      await updateRuleApi(props.editData.id, payload)
      ElMessage.success('更新成功')
    } else {
      await createRuleApi(payload)
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

onMounted(() => loadChannels())
</script>
