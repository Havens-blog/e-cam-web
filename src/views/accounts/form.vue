<template>
  <el-form ref="formRef" :model="formData" :rules="rules" label-width="120px">
    <el-form-item label="租户" prop="tenant_id">
      <TenantSelector
        v-model="formData.tenant_id"
        placeholder="请选择租户"
        style="width: 100%"
      />
      <span class="form-tip">选择该云账号所属的租户</span>
    </el-form-item>

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
        maxlength="128"
      >
        <template v-if="isEdit" #suffix>
          <el-text type="info" size="small">可修改</el-text>
        </template>
      </el-input>
    </el-form-item>

    <el-form-item label="AK Secret" prop="access_key_secret">
      <el-input
        v-model="formData.access_key_secret"
        type="password"
        :placeholder="isEdit ? '留空表示不修改' : '请输入Access Key Secret'"
        show-password
        maxlength="128"
      >
        <template v-if="isEdit" #suffix>
          <el-text type="info" size="small"></el-text>
        </template>
      </el-input>
      <span v-if="isEdit" class="form-tip">出于安全考虑，密钥不会显示。如需修改请输入新密钥。</span>
    </el-form-item>

    <el-form-item label="区域" prop="regions">
      <div style="display: flex; gap: 8px; width: 100%;">
        <el-select
          v-model="formData.regions"
          placeholder="请选择区域（可多选）"
          :disabled="!formData.provider"
          style="flex: 1"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="3"
        >
          <el-option
            v-for="r in availableRegions"
            :key="r.value"
            :label="r.label"
            :value="r.value"
          />
        </el-select>
        <el-button
          v-if="isEdit"
          :loading="testingConnection"
          @click="testConnection"
        >
          <el-icon v-if="!testingConnection"><Connection /></el-icon>
          {{ testingConnection ? '测试中...' : '获取区域' }}
        </el-button>
      </div>
      <span v-if="realRegions.length > 0" class="form-tip">
        已从云平台获取到 {{ realRegions.length }} 个可用区域，已选择 {{ formData.regions.length }} 个
      </span>
      <span v-else-if="isEdit" class="form-tip">
        点击"获取区域"按钮从云平台获取最新的区域列表
      </span>
      <span v-else class="form-tip">
        可选择多个区域，留空表示所有区域
      </span>
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

    <el-form-item label="自动同步用户">
      <el-switch v-model="formData.config.enable_user_sync" />
      <span class="form-tip">启用后将自动同步该账号下的 IAM 用户</span>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { createCloudAccountApi, testConnectionApi, updateCloudAccountApi } from '@/api'
import type { CloudAccount } from '@/api/types/account'
import TenantSelector from '@/components/TenantSelector.vue'
import {
  CLOUD_PROVIDERS,
  ENVIRONMENTS,
  accountFormRules,
  getProviderRegions,
} from '@/utils/constants'
import { Connection } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance } from 'element-plus'
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
  tenant_id: '',
  name: '',
  provider: '',
  environment: '',
  access_key_id: '',
  access_key_secret: '',
  region: '',
  regions: [] as string[],
  description: '',
  config: {
    enable_auto_sync: false,
    sync_interval: 60,
    read_only: false,
    enable_user_sync: false,
    show_sub_accounts: false,
    enable_cost_monitoring: true,
  },
})

// 验证规则
const rules = accountFormRules

// 区域列表状态
const realRegions = ref<string[]>([])
const testingConnection = ref(false)

// 计算可用区域
const availableRegions = computed(() => {
  // 如果有真实的区域列表（测试连接获取的），优先使用
  if (realRegions.value.length > 0) {
    return realRegions.value.map(r => ({
      value: r,
      label: r,
    }))
  }
  
  // 否则使用默认的区域列表
  if (!formData.provider) return []
  return getProviderRegions(formData.provider)
})

// 测试连接并获取区域列表
const testConnection = async () => {
  // 验证必填字段
  if (!formData.access_key_id) {
    ElMessage.warning('请先输入 Access Key ID')
    return
  }
  
  if (!formData.access_key_secret && !props.isEdit) {
    ElMessage.warning('请先输入 Access Key Secret')
    return
  }

  testingConnection.value = true
  
  try {
    // 如果是编辑模式且有账号ID，直接调用测试连接API
    if (props.isEdit && props.account) {
      const { data } = await testConnectionApi(props.account.id)
      
      if (data.status === 'success') {
        if (data.regions && data.regions.length > 0) {
          realRegions.value = data.regions
          ElMessage.success(`连接测试成功！获取到 ${data.regions.length} 个可用区域`)
        } else {
          ElMessage.success('连接测试成功！')
        }
      } else {
        ElMessage.error(`连接测试失败：${data.message}`)
      }
    } else {
      // 创建模式下，需要先创建临时账号或使用其他方式测试
      ElMessage.info('请先保存账号后再测试连接')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '测试连接失败')
  } finally {
    testingConnection.value = false
  }
}

// 自动获取区域列表（静默模式）
const autoFetchRegions = async (accountId: number) => {
  try {
    const { data } = await testConnectionApi(accountId)
    
    if (data.status === 'success' && data.regions && data.regions.length > 0) {
      realRegions.value = data.regions
    }
  } catch (error) {
    // 静默失败，不显示错误提示
    console.warn('自动获取区域列表失败:', error)
  }
}

// 监听云厂商变化，重置区域选择和真实区域列表
watch(
  () => formData.provider,
  (newProvider, oldProvider) => {
    if (newProvider !== oldProvider && !props.isEdit) {
      formData.region = ''
      formData.regions = []
      realRegions.value = []
    }
  }
)

// 监听 account 变化，填充表单并自动获取区域
watch(
  () => props.account,
  async (account) => {
    if (account) {
      formData.tenant_id = account.tenant_id || ''
      formData.name = account.name
      formData.provider = account.provider
      formData.environment = account.environment
      formData.access_key_id = account.access_key_id
      formData.region = account.region
      
      // 填充已选择的区域
      if (account.regions && account.regions.length > 0) {
        // 如果有 regions 数组，直接使用
        formData.regions = [...account.regions]
      } else if (account.region) {
        // 如果只有单个 region，转换为数组
        formData.regions = [account.region]
      } else {
        formData.regions = []
      }
      
      formData.description = account.description || ''
      formData.config = { 
        ...account.config,
        enable_user_sync: account.config?.enable_user_sync || false
      }
      
      // 编辑模式下自动获取区域列表
      if (props.isEdit) {
        await autoFetchRegions(account.id)
      }
    }
  },
  { immediate: true }
)

// 提交表单
const submit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  if (props.isEdit && props.account) {
    // 更新账号 - 构建更新数据
    const updateData: any = {
      tenant_id: formData.tenant_id,
      name: formData.name,
      environment: formData.environment,
      // 使用第一个区域作为主区域，或者使用 regions 数组
      region: formData.regions.length > 0 ? formData.regions[0] : formData.region,
      regions: formData.regions,
      description: formData.description,
      config: formData.config,
    }

    // 如果修改了 Access Key ID，添加到更新数据
    if (formData.access_key_id !== props.account.access_key_id) {
      updateData.access_key_id = formData.access_key_id
    }

    // 如果输入了新的 Secret，添加到更新数据
    if (formData.access_key_secret) {
      updateData.access_key_secret = formData.access_key_secret
    }

    await updateCloudAccountApi(props.account.id, updateData)
  } else {
    // 创建账号
    const createData: any = {
      tenant_id: formData.tenant_id || 'default',
      name: formData.name,
      provider: formData.provider,
      environment: formData.environment,
      access_key_id: formData.access_key_id,
      access_key_secret: formData.access_key_secret,
      region: formData.regions.length > 0 ? formData.regions[0] : 'default',
      description: formData.description,
      config: formData.config,
    }
    
    if (formData.regions.length > 0) {
      createData.regions = formData.regions
    }
    
    await createCloudAccountApi(createData)
  }
}

// 重置表单
const reset = () => {
  formRef.value?.resetFields()
  formData.regions = []
  realRegions.value = []
  formData.config = {
    enable_auto_sync: false,
    sync_interval: 60,
    read_only: false,
    enable_user_sync: false,
    show_sub_accounts: false,
    enable_cost_monitoring: true,
  }
}

// 暴露方法
defineExpose({
  submit,
  reset,
  testConnection,
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
