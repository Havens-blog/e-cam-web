<template>
  <el-form ref="formRef" :model="formData" :rules="rules" label-width="120px">
    <el-form-item label="账号名称" prop="name">
      <el-input
        v-model="formData.name"
        placeholder="请输入账号名称"
        maxlength="50"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="云厂商" prop="provider">
      <el-select
        v-model="formData.provider"
        placeholder="请选择云厂商"
        :disabled="isEdit"
        style="width: 100%"
      >
        <el-option
          v-for="p in CLOUD_PROVIDERS"
          :key="p.value"
          :label="p.label"
          :value="p.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="环境" prop="environment">
      <el-select
        v-model="formData.environment"
        placeholder="请选择环境"
        style="width: 100%"
      >
        <el-option
          v-for="e in ENVIRONMENTS"
          :key="e.value"
          :label="e.label"
          :value="e.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="Access Key ID" prop="access_key_id">
      <el-input
        v-model="formData.access_key_id"
        placeholder="请输入Access Key ID"
        :disabled="isEdit"
        maxlength="128"
      />
    </el-form-item>

    <el-form-item v-if="!isEdit" label="Access Key Secret" prop="access_key_secret">
      <el-input
        v-model="formData.access_key_secret"
        type="password"
        placeholder="请输入Access Key Secret"
        show-password
        maxlength="128"
      />
    </el-form-item>

    <el-form-item label="区域" prop="region">
      <el-select
        v-model="formData.region"
        placeholder="请选择区域"
        :disabled="isEdit || !formData.provider"
        style="width: 100%"
        filterable
      >
        <el-option
          v-for="r in availableRegions"
          :key="r.value"
          :label="r.label"
          :value="r.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="描述">
      <el-input
        v-model="formData.description"
        type="textarea"
        :rows="3"
        placeholder="请输入账号描述（可选）"
        maxlength="200"
        show-word-limit
      />
    </el-form-item>

    <el-divider content-position="left">配置选项</el-divider>

    <el-form-item label="自动同步">
      <el-switch v-model="formData.config.enable_auto_sync" />
      <span class="form-tip">启用后将自动同步资产</span>
    </el-form-item>

    <el-form-item v-if="formData.config.enable_auto_sync" label="同步间隔">
      <el-input-number
        v-model="formData.config.sync_interval"
        :min="5"
        :max="1440"
        :step="5"
        controls-position="right"
      />
      <span class="form-tip">分钟（5-1440）</span>
    </el-form-item>

    <el-form-item label="只读模式">
      <el-switch v-model="formData.config.read_only" />
      <span class="form-tip">启用后仅读取资产信息，不执行操作</span>
    </el-form-item>

    <el-form-item label="显示子账号">
      <el-switch v-model="formData.config.show_sub_accounts" />
      <span class="form-tip">显示该账号下的子账号资产</span>
    </el-form-item>

    <el-form-item label="成本监控">
      <el-switch v-model="formData.config.enable_cost_monitoring" />
      <span class="form-tip">启用成本监控和分析</span>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { createCloudAccountApi, updateCloudAccountApi } from '@/api'
import type { CloudAccount } from '@/api/types/account'
import {
  CLOUD_PROVIDERS,
  ENVIRONMENTS,
  accountFormRules,
  getProviderRegions,
} from '@/utils/constants'
import type { FormInstance } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

interface Props {
  account?: CloudAccount | null
  isEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  account: null,
  isEdit: false,
})

const formRef = ref<FormInstance>()

// 表单数据
const formData = reactive({
  name: '',
  provider: '',
  environment: '',
  access_key_id: '',
  access_key_secret: '',
  region: '',
  description: '',
  config: {
    enable_auto_sync: false,
    sync_interval: 60,
    read_only: false,
    show_sub_accounts: false,
    enable_cost_monitoring: true,
  },
})

// 验证规则
const rules = accountFormRules

// 计算可用区域
const availableRegions = computed(() => {
  if (!formData.provider) return []
  return getProviderRegions(formData.provider)
})

// 监听云厂商变化，重置区域选择
watch(
  () => formData.provider,
  (newProvider, oldProvider) => {
    if (newProvider !== oldProvider && !props.isEdit) {
      formData.region = ''
    }
  }
)

// 监听 account 变化，填充表单
watch(
  () => props.account,
  (account) => {
    if (account) {
      formData.name = account.name
      formData.provider = account.provider
      formData.environment = account.environment
      formData.access_key_id = account.access_key_id
      formData.region = account.region
      formData.description = account.description || ''
      formData.config = { ...account.config }
    }
  },
  { immediate: true }
)

// 提交表单
const submit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  if (props.isEdit && props.account) {
    // 更新账号
    await updateCloudAccountApi(props.account.id, {
      name: formData.name,
      description: formData.description,
      config: formData.config,
    })
  } else {
    // 创建账号
    await createCloudAccountApi({
      name: formData.name,
      provider: formData.provider as any,
      environment: formData.environment as any,
      access_key_id: formData.access_key_id,
      access_key_secret: formData.access_key_secret,
      region: formData.region,
      description: formData.description,
      config: formData.config,
      tenant_id: 'default', // TODO: 从用户上下文获取租户ID
    })
  }
}

// 重置表单
const reset = () => {
  formRef.value?.resetFields()
  formData.config = {
    enable_auto_sync: false,
    sync_interval: 60,
    read_only: false,
    show_sub_accounts: false,
    enable_cost_monitoring: true,
  }
}

// 暴露方法
defineExpose({
  submit,
  reset,
})
</script>

<style scoped lang="scss">
.form-tip {
  margin-left: calc(0.5rem + 0.1vw);
  font-size: calc(0.65rem + 0.1vw);
  color: #9ca3af;
}

:deep(.el-divider__text) {
  font-size: calc(0.75rem + 0.1vw);
  font-weight: 600;
  color: #6b7280;
}
</style>
