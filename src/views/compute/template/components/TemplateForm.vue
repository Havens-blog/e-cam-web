<template>
  <el-drawer
    :model-value="visible"
    :title="templateData ? '编辑模板' : '创建模板'"
    size="600px"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="模板名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入模板名称" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="模板描述" />
      </el-form-item>

      <CascadeSelectors v-model="cascadeForm" :accounts="safeAccounts" />

      <!-- 可选参数 -->
      <el-divider>可选参数</el-divider>
      <el-form-item label="实例名称前缀">
        <el-input v-model="form.instance_name_prefix" placeholder="如 web-server" />
      </el-form-item>
      <el-form-item label="主机名前缀">
        <el-input v-model="form.host_name_prefix" placeholder="如 web" />
      </el-form-item>
      <el-form-item label="系统盘类型">
        <el-select v-model="form.system_disk_type" placeholder="系统盘类型" clearable style="width: 100%">
          <el-option label="高效云盘" value="cloud_efficiency" />
          <el-option label="SSD 云盘" value="cloud_ssd" />
          <el-option label="ESSD 云盘" value="cloud_essd" />
        </el-select>
      </el-form-item>
      <el-form-item label="系统盘大小(GB)">
        <el-input-number v-model="form.system_disk_size" :min="20" :max="500" />
      </el-form-item>
      <el-form-item label="公网带宽(Mbps)">
        <el-input-number v-model="form.bandwidth_out" :min="0" :max="200" />
      </el-form-item>
      <el-form-item label="计费方式">
        <el-select v-model="form.charge_type" placeholder="计费方式" clearable style="width: 100%">
          <el-option label="按量付费" value="PostPaid" />
          <el-option label="包年包月" value="PrePaid" />
        </el-select>
      </el-form-item>
      <el-form-item label="密钥对">
        <el-input v-model="form.key_pair_name" placeholder="密钥对名称" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ templateData ? '更新' : '创建' }}
      </el-button>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { createTemplateApi, updateTemplateApi } from '@/api/template'
import type { VMTemplate } from '@/api/types/template'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import CascadeSelectors from './CascadeSelectors.vue'

interface AccountOption {
  id: number
  name: string
  provider: string
  regions: string[]
}

const props = defineProps<{
  visible: boolean
  templateData: VMTemplate | null
  accounts?: AccountOption[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'success'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)

const safeAccounts = computed(() =>
  (props.accounts || []).filter(item => item != null)
)

const form = reactive({
  name: '',
  description: '',
  instance_name_prefix: '',
  host_name_prefix: '',
  system_disk_type: '',
  system_disk_size: 40,
  bandwidth_out: 0,
  charge_type: '',
  key_pair_name: ''
})

const cascadeForm = ref({
  cloud_account_id: undefined as number | undefined,
  provider: '',
  region: '',
  zone: '',
  instance_type: '',
  image_id: '',
  vpc_id: '',
  subnet_id: '',
  security_group_ids: [] as string[]
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }]
}

watch(() => props.templateData, (val) => {
  if (val) {
    form.name = val.name || ''
    form.description = val.description || ''
    form.instance_name_prefix = val.instance_name_prefix || ''
    form.host_name_prefix = val.host_name_prefix || ''
    form.system_disk_type = val.system_disk_type || ''
    form.system_disk_size = val.system_disk_size || 40
    form.bandwidth_out = val.bandwidth_out || 0
    form.charge_type = val.charge_type || ''
    form.key_pair_name = val.key_pair_name || ''
    cascadeForm.value = {
      cloud_account_id: val.cloud_account_id,
      provider: val.provider || '',
      region: val.region || '',
      zone: val.zone || '',
      instance_type: val.instance_type || '',
      image_id: val.image_id || '',
      vpc_id: val.vpc_id || '',
      subnet_id: val.subnet_id || '',
      security_group_ids: val.security_group_ids || []
    }
  }
}, { immediate: true })

function handleClose() {
  emit('update:visible', false)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const reqData = {
    name: form.name,
    description: form.description,
    provider: cascadeForm.value.provider,
    cloud_account_id: cascadeForm.value.cloud_account_id!,
    region: cascadeForm.value.region,
    zone: cascadeForm.value.zone,
    instance_type: cascadeForm.value.instance_type,
    image_id: cascadeForm.value.image_id,
    vpc_id: cascadeForm.value.vpc_id,
    subnet_id: cascadeForm.value.subnet_id,
    security_group_ids: cascadeForm.value.security_group_ids,
    instance_name_prefix: form.instance_name_prefix,
    host_name_prefix: form.host_name_prefix,
    system_disk_type: form.system_disk_type,
    system_disk_size: form.system_disk_size,
    bandwidth_out: form.bandwidth_out,
    charge_type: form.charge_type,
    key_pair_name: form.key_pair_name
  }

  submitting.value = true
  try {
    if (props.templateData) {
      await updateTemplateApi(props.templateData.id, reqData)
      ElMessage.success('更新成功')
    } else {
      await createTemplateApi(reqData)
      ElMessage.success('创建成功')
    }
    emit('success')
  } catch {
    ElMessage.error(props.templateData ? '更新失败' : '创建失败')
  } finally {
    submitting.value = false
  }
}
</script>
