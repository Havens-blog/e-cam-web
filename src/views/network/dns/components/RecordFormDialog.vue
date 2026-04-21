<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑解析记录' : '添加解析记录'"
    width="560px"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
      <el-form-item label="主机记录" prop="rr">
        <el-input v-model="form.rr" placeholder="如 www、@、mail" />
      </el-form-item>
      <el-form-item label="记录类型" prop="type">
        <el-select v-model="form.type" placeholder="请选择记录类型" style="width: 100%" @change="handleTypeChange">
          <el-option v-for="t in recordTypes" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item label="记录值" prop="value">
        <el-input v-model="form.value" :placeholder="valuePlaceholder" />
      </el-form-item>
      <div class="form-row">
        <el-form-item label="TTL" prop="ttl">
          <el-input-number v-model="form.ttl" :min="1" :max="86400" style="width: 100%" />
        </el-form-item>
        <el-form-item label="线路" prop="line">
          <el-select v-model="form.line" style="width: 100%">
            <el-option label="默认" value="default" />
            <el-option label="电信" value="telecom" />
            <el-option label="联通" value="unicom" />
            <el-option label="移动" value="mobile" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item v-if="form.type === 'MX'" label="MX 优先级" prop="priority">
        <el-input-number v-model="form.priority" :min="1" :max="65535" style="width: 100%" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">{{ isEdit ? '保存' : '添加' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { createDnsRecordApi, updateDnsRecordApi } from '@/api/dns'
import type { DnsRecord } from '@/api/types/dns'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

interface Props {
  visible: boolean
  domain: string
  accountId: number
  record?: DnsRecord | null
}

const props = withDefaults(defineProps<Props>(), { record: null })
const emit = defineEmits<{
  'update:visible': [val: boolean]
  'success': []
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const isEdit = computed(() => !!props.record)

const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA']

const form = reactive({
  rr: '',
  type: 'A',
  value: '',
  ttl: 600,
  priority: 10,
  line: 'default',
})

const valuePlaceholder = computed(() => {
  const map: Record<string, string> = {
    A: '如 1.2.3.4',
    AAAA: '如 2001:db8::1',
    CNAME: '如 cdn.example.com',
    MX: '如 mail.example.com',
    TXT: '如 v=spf1 include:...',
    NS: '如 ns1.example.com',
    SRV: '如 0 5 5060 sip.example.com',
    CAA: '如 0 issue "letsencrypt.org"',
  }
  return map[form.type] || '请输入记录值'
})

// Validators
const ipv4Regex = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/
const ipv6Regex = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$|^::$|^([\da-fA-F]{1,4}:){1,7}:$|^:((:[\da-fA-F]{1,4}){1,7}|:)$|^[\da-fA-F]{1,4}:((:[\da-fA-F]{1,4}){1,6}|:)$|^([\da-fA-F]{1,4}:){2}((:[\da-fA-F]{1,4}){1,5}|:)$|^([\da-fA-F]{1,4}:){3}((:[\da-fA-F]{1,4}){1,4}|:)$|^([\da-fA-F]{1,4}:){4}((:[\da-fA-F]{1,4}){1,3}|:)$|^([\da-fA-F]{1,4}:){5}((:[\da-fA-F]{1,4}){1,2}|:)$|^([\da-fA-F]{1,4}:){6}(:[\da-fA-F]{1,4}|:)$/
const domainRegex = /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z]{2,}\.?$/

const validateValue = (_rule: any, value: string, callback: (err?: Error) => void) => {
  if (!value || !value.trim()) {
    callback(new Error('记录值不能为空'))
    return
  }
  const v = value.trim()
  switch (form.type) {
    case 'A':
      if (!ipv4Regex.test(v)) { callback(new Error('请输入合法的 IPv4 地址')); return }
      break
    case 'AAAA':
      if (!ipv6Regex.test(v)) { callback(new Error('请输入合法的 IPv6 地址')); return }
      break
    case 'CNAME':
    case 'MX':
    case 'NS':
      if (!domainRegex.test(v)) { callback(new Error('请输入合法的域名格式')); return }
      break
    case 'TXT':
      if (v.length > 512) { callback(new Error('TXT 记录值不能超过 512 个字符')); return }
      break
  }
  callback()
}

const rules: FormRules = {
  rr: [{ required: true, message: '主机记录不能为空', trigger: 'blur' }],
  type: [{ required: true, message: '请选择记录类型', trigger: 'change' }],
  value: [
    { required: true, message: '记录值不能为空', trigger: 'blur' },
    { validator: validateValue, trigger: 'blur' },
  ],
  ttl: [{ required: true, message: 'TTL 不能为空', trigger: 'blur' }],
  priority: [{ required: true, message: 'MX 优先级不能为空', trigger: 'blur' }],
}

const handleTypeChange = () => {
  formRef.value?.clearValidate('value')
}

const handleClose = () => {
  formRef.value?.resetFields()
}

const handleSubmit = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (isEdit.value && props.record) {
      await updateDnsRecordApi(props.domain, props.record.record_id, {
        account_id: props.accountId,
        rr: form.rr,
        type: form.type,
        value: form.value,
        ttl: form.ttl,
        priority: form.type === 'MX' ? form.priority : undefined,
        line: form.line,
      })
      ElMessage.success('修改成功')
    } else {
      await createDnsRecordApi(props.domain, {
        account_id: props.accountId,
        rr: form.rr,
        type: form.type,
        value: form.value,
        ttl: form.ttl,
        priority: form.type === 'MX' ? form.priority : undefined,
        line: form.line,
      })
      ElMessage.success('添加成功')
    }
    emit('update:visible', false)
    emit('success')
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '操作失败'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}

// Pre-fill form when editing
watch(() => props.visible, (val) => {
  if (val && props.record) {
    form.rr = props.record.rr || ''
    form.type = props.record.type || 'A'
    form.value = props.record.value || ''
    form.ttl = props.record.ttl || 600
    form.priority = props.record.priority || 10
    form.line = props.record.line || 'default'
  } else if (val) {
    form.rr = ''
    form.type = 'A'
    form.value = ''
    form.ttl = 600
    form.priority = 10
    form.line = 'default'
  }
})
</script>

<style scoped lang="scss">
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
</style>
