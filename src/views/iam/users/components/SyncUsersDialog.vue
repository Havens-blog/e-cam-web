<template>
  <el-dialog
    v-model="dialogVisible"
    title="同步云平台用户"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading" class="sync-users-dialog">
      <!-- 云账号选择 -->
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="租户" prop="tenant_id">
          <TenantSelector
            v-model="formData.tenant_id"
            placeholder="请选择租户"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="云账号" prop="cloud_account_id">
          <el-select
            v-model="formData.cloud_account_id"
            placeholder="请选择要同步的云账号"
            style="width: 100%"
            filterable
            :loading="loadingAccounts"
            @change="handleAccountChange"
          >
            <el-option
              v-for="account in cloudAccounts"
              :key="account.id"
              :label="`${account.name} (${getProviderLabel(account.provider)})`"
              :value="account.id"
            >
              <div class="account-option">
                <span class="account-name">{{ account.name }}</span>
                <el-tag size="small" :type="getProviderType(account.provider) as any">
                  {{ getProviderLabel(account.provider) }}
                </el-tag>
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <!-- 同步选项 -->
        <el-form-item label="同步选项">
          <el-checkbox-group v-model="formData.options">
            <el-checkbox value="create_new">创建新用户</el-checkbox>
            <el-checkbox value="update_existing">更新现有用户</el-checkbox>
            <el-checkbox value="sync_permissions">同步权限信息</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>

      <!-- 说明信息 -->
      <el-alert type="info" :closable="false" show-icon class="sync-info">
        <template #title>同步说明</template>
        <template #default>
          <ul class="info-list">
            <li>系统将从云平台获取最新的用户信息</li>
            <li>同步过程可能需要几分钟时间,请耐心等待</li>
            <li>同步完成后会自动刷新用户列表</li>
            <li v-if="selectedAccount">
              当前选择: {{ selectedAccount.name }} ({{ getProviderLabel(selectedAccount.provider) }})
            </li>
          </ul>
        </template>
      </el-alert>

      <!-- 同步进度 -->
      <div v-if="syncing" class="sync-progress">
        <el-progress
          :percentage="progress"
          :status="progressStatus"
          :stroke-width="20"
        />
        <div class="progress-text">
          {{ progressText }}
        </div>
      </div>

      <!-- 同步结果 -->
      <div v-if="syncResult" class="sync-result">
        <el-alert
          :title="syncResult.success ? '同步完成' : '同步失败'"
          :type="syncResult.success ? 'success' : 'error'"
          :closable="false"
          show-icon
        >
          <template #default>
            <div class="result-details">
              <p v-if="syncResult.success">
                成功同步 {{ syncResult.totalCount }} 个用户
              </p>
              <p v-if="syncResult.newCount > 0">
                新增: {{ syncResult.newCount }} 个用户
              </p>
              <p v-if="syncResult.updatedCount > 0">
                更新: {{ syncResult.updatedCount }} 个用户
              </p>
              <p v-if="syncResult.errorMessage">
                错误: {{ syncResult.errorMessage }}
              </p>
            </div>
          </template>
        </el-alert>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose" :disabled="syncing">取消</el-button>
      <el-button
        type="primary"
        :loading="syncing"
        :disabled="syncing || (syncResult !== null)"
        @click="handleSubmit"
      >
        {{ syncing ? '同步中...' : '开始同步' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { listCloudAccountsApi, syncUsersApi } from '@/api'
import TenantSelector from '@/components/TenantSelector.vue'
import { getProviderLabel } from '@/utils/constants'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

interface Props {
  visible: boolean
  tenantId?: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const loadingAccounts = ref(false)
const syncing = ref(false)
const progress = ref(0)
const progressText = ref('')
const syncResult = ref<{
  success: boolean
  totalCount: number
  newCount: number
  updatedCount: number
  errorMessage?: string
} | null>(null)

const cloudAccounts = ref<any[]>([])

const formData = ref({
  tenant_id: '',
  cloud_account_id: null as number | null,
  options: ['create_new', 'update_existing', 'sync_permissions'] as string[]
})

const rules: FormRules = {
  tenant_id: [
    { required: true, message: '请选择租户', trigger: 'change' }
  ],
  cloud_account_id: [
    { required: true, message: '请选择云账号', trigger: 'change' }
  ]
}

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const selectedAccount = computed(() => {
  if (!formData.value.cloud_account_id) return null
  return cloudAccounts.value.find(a => a.id === formData.value.cloud_account_id)
})

const progressStatus = computed(() => {
  if (syncResult.value) {
    return syncResult.value.success ? 'success' : 'exception'
  }
  return undefined
})

// 获取云平台类型
const getProviderType = (provider: string) => {
  const typeMap: Record<string, string> = {
    aliyun: 'warning',
    aws: 'danger',
    azure: 'primary',
    tencent: 'success',
    huawei: 'info'
  }
  return typeMap[provider] || 'info'
}

// 获取云账号列表
const fetchCloudAccounts = async () => {
  loadingAccounts.value = true
  try {
    const { data } = await listCloudAccountsApi({ limit: 100 })
    cloudAccounts.value = data.accounts
  } catch (error) {
    console.error('获取云账号列表失败:', error)
    ElMessage.error('获取云账号列表失败')
  } finally {
    loadingAccounts.value = false
  }
}

// 云账号变化
const handleAccountChange = () => {
  // 可以根据选择的云账号显示更多信息
}

// 模拟同步进度
const simulateProgress = async () => {
  const steps = [
    { progress: 20, text: '正在连接云平台...' },
    { progress: 40, text: '正在获取用户列表...' },
    { progress: 60, text: '正在同步用户信息...' },
    { progress: 80, text: '正在更新权限信息...' },
    { progress: 100, text: '同步完成' }
  ]

  for (const step of steps) {
    progress.value = step.progress
    progressText.value = step.text
    await new Promise(resolve => setTimeout(resolve, 800))
  }
}

// 提交同步
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  syncing.value = true
  progress.value = 0
  progressText.value = '准备同步...'
  syncResult.value = null

  try {
    // 启动进度模拟
    const progressPromise = simulateProgress()

    // 调用同步 API
    const response = await syncUsersApi({
      tenant_id: formData.value.tenant_id,
      cloud_account_id: formData.value.cloud_account_id!
    })

    // 等待进度完成
    await progressPromise

    // 设置同步结果
    const data = response.data as any
    syncResult.value = {
      success: true,
      totalCount: data?.total_count || 0,
      newCount: data?.new_count || 0,
      updatedCount: data?.updated_count || 0
    }

    ElMessage.success('用户同步成功')

    // 延迟关闭对话框
    setTimeout(() => {
      emit('success')
      handleClose()
    }, 2000)
  } catch (error: any) {
    console.error('同步用户失败:', error)

    syncResult.value = {
      success: false,
      totalCount: 0,
      newCount: 0,
      updatedCount: 0,
      errorMessage: error.message || '同步失败'
    }

    ElMessage.error(error.message || '同步用户失败')
  } finally {
    syncing.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  if (syncing.value) {
    ElMessage.warning('正在同步中,请稍候...')
    return
  }

  // 重置表单
  formRef.value?.resetFields()
  formData.value.tenant_id = ''
  formData.value.cloud_account_id = null
  formData.value.options = ['create_new', 'update_existing', 'sync_permissions']
  progress.value = 0
  progressText.value = ''
  syncResult.value = null

  emit('update:visible', false)
}

// 监听对话框打开
watch(() => props.visible, (visible) => {
  if (visible) {
    // 如果父组件传递了租户ID，自动填充
    if (props.tenantId) {
      formData.value.tenant_id = props.tenantId
    }
    fetchCloudAccounts()
  }
})

// 初始化
onMounted(() => {
  if (props.visible) {
    fetchCloudAccounts()
  }
})
</script>

<style scoped lang="scss">
.sync-users-dialog {
  .account-option {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .account-name {
      font-weight: 500;
    }
  }

  .sync-info {
    margin-top: 20px;

    .info-list {
      margin: 8px 0;
      padding-left: 20px;

      li {
        margin: 4px 0;
        line-height: 1.6;
      }
    }
  }

  .sync-progress {
    margin-top: 20px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 4px;

    .progress-text {
      margin-top: 12px;
      text-align: center;
      font-size: 14px;
      color: #606266;
      font-weight: 500;
    }
  }

  .sync-result {
    margin-top: 20px;

    .result-details {
      p {
        margin: 4px 0;
        line-height: 1.6;
      }
    }
  }
}
</style>
