<template>
  <el-dialog
    v-model="dialogVisible"
    title="创建同步任务"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="任务类型" prop="task_type">
        <el-select
          v-model="formData.task_type"
          placeholder="请选择任务类型"
          style="width: 100%"
        >
          <el-option
            v-for="type in SYNC_TASK_TYPES"
            :key="type.value"
            :label="type.label"
            :value="type.value"
          >
            <div class="option-content">
              <span class="option-label">{{ type.label }}</span>
              <span class="option-description">{{ type.description }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="云账号" prop="cloud_account_id">
        <el-select
          v-model="formData.cloud_account_id"
          placeholder="请选择云账号"
          filterable
          style="width: 100%"
          @change="handleAccountChange"
        >
          <el-option
            v-for="account in cloudAccounts"
            :key="account.id"
            :label="account.name"
            :value="account.id"
          >
            <div class="option-content">
              <span class="option-label">{{ account.name }}</span>
              <el-tag size="small" style="margin-left: 8px">
                {{ getProviderLabel(account.provider) }}
              </el-tag>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item
        v-if="formData.task_type === 'sync_user' || formData.task_type === 'sync_group'"
        label="目标类型"
        prop="target_type"
      >
        <el-radio-group v-model="formData.target_type">
          <el-radio value="all">全部</el-radio>
          <el-radio value="specific">指定对象</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item
        v-if="formData.target_type === 'specific'"
        label="目标 ID"
        prop="target_id"
      >
        <el-input
          v-model="formData.target_id"
          placeholder="请输入目标对象的 ID"
        />
        <div class="form-tip">
          输入要同步的用户或权限组的 ID
        </div>
      </el-form-item>

      <el-form-item label="同步选项">
        <el-checkbox-group v-model="formData.options">
          <el-checkbox value="force">强制同步（覆盖本地数据）</el-checkbox>
          <el-checkbox value="delete_missing">删除云端不存在的对象</el-checkbox>
          <el-checkbox value="sync_policies">同步权限策略</el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          placeholder="请输入任务描述（可选）"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ submitting ? '创建中...' : '创建任务' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api'
import { createSyncTaskApi } from '@/api/iam'
import type { CloudAccount } from '@/api/types'
import { CLOUD_PROVIDERS, SYNC_TASK_TYPES } from '@/utils/constants'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const cloudAccounts = ref<CloudAccount[]>([])

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 表单数据
const formData = reactive({
  task_type: '',
  cloud_account_id: '',
  target_type: 'all' as 'all' | 'specific',
  target_id: '',
  options: [] as string[],
  description: ''
})

// 表单验证规则
const rules: FormRules = {
  task_type: [
    { required: true, message: '请选择任务类型', trigger: 'change' }
  ],
  cloud_account_id: [
    { required: true, message: '请选择云账号', trigger: 'change' }
  ],
  target_id: [
    { required: true, message: '请输入目标 ID', trigger: 'blur' }
  ]
}

// 加载云账号列表
const loadCloudAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ size: 100 })
    cloudAccounts.value = res.data.accounts || []
  } catch (error) {
    console.error('加载云账号列表失败:', error)
    ElMessage.error('加载云账号列表失败')
  }
}

// 云账号变化
const handleAccountChange = () => {
  // 可以根据选择的云账号更新其他字段
}

// 获取云平台标签
const getProviderLabel = (provider: string): string => {
  const item = CLOUD_PROVIDERS.find(p => p.value === provider)
  return item?.label || provider
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true

  try {
    // 构建任务数据
    const taskData: any = {
      task_type: formData.task_type,
      cloud_account_id: formData.cloud_account_id,
      description: formData.description || undefined,
      config: {
        options: formData.options
      }
    }

    // 如果是指定对象,添加目标 ID
    if (formData.target_type === 'specific' && formData.target_id) {
      taskData.target_id = formData.target_id
    }

    // 调用创建任务 API
    await createSyncTaskApi(taskData)

    ElMessage.success('同步任务创建成功')
    emit('success')
    handleClose()
  } catch (error: any) {
    console.error('创建任务失败:', error)
    ElMessage.error(error.message || '创建任务失败')
  } finally {
    submitting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  formRef.value?.resetFields()
  formData.task_type = ''
  formData.cloud_account_id = ''
  formData.target_type = 'all'
  formData.target_id = ''
  formData.options = []
  formData.description = ''
  emit('update:visible', false)
}

// 初始化
onMounted(() => {
  loadCloudAccounts()
})
</script>

<style scoped lang="scss">
.option-content {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .option-label {
    font-weight: 500;
  }

  .option-description {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-left: 8px;
  }
}

.form-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
