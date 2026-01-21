<template>
  <el-dialog
    v-model="dialogVisible"
    title="批量分配权限组"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div v-loading="loading" class="batch-assign-dialog">
      <!-- 选中用户信息 -->
      <el-alert
        :title="`已选择 ${userIds.length} 个用户`"
        type="info"
        :closable="false"
        show-icon
        class="user-count-alert"
      />

      <!-- 权限组选择 -->
      <el-form :model="formData" :rules="rules" ref="formRef" label-width="100px" class="assign-form">
        <el-form-item label="权限组" prop="groupIds">
          <el-select
            v-model="formData.groupIds"
            multiple
            filterable
            placeholder="请选择要分配的权限组"
            style="width: 100%"
            :loading="loadingGroups"
          >
            <el-option
              v-for="group in permissionGroups"
              :key="group.id"
              :label="group.name"
              :value="group.id"
            >
              <div class="group-option">
                <span class="group-name">{{ group.name }}</span>
                <span class="group-description">{{ group.description || '暂无描述' }}</span>
              </div>
            </el-option>
          </el-select>
          <div class="form-tip">可以选择多个权限组同时分配给所选用户</div>
        </el-form-item>

        <el-form-item label="分配模式" prop="assignMode">
          <el-radio-group v-model="formData.assignMode">
            <el-radio value="append">追加模式</el-radio>
            <el-radio value="replace">替换模式</el-radio>
          </el-radio-group>
          <div class="form-tip">
            <span v-if="formData.assignMode === 'append'">
              追加模式：在用户现有权限组基础上添加新的权限组
            </span>
            <span v-else>
              替换模式：清除用户现有权限组,仅保留本次选择的权限组
            </span>
          </div>
        </el-form-item>
      </el-form>

      <!-- 进度显示 -->
      <div v-if="assigning" class="progress-section">
        <el-progress
          :percentage="progress"
          :status="progressStatus"
        />
        <div class="progress-text">
          正在分配权限组... ({{ assignedCount }}/{{ userIds.length }})
        </div>
      </div>

      <!-- 结果显示 -->
      <div v-if="assignResult" class="result-section">
        <el-alert
          :title="assignResult.success ? '批量分配完成' : '批量分配失败'"
          :type="assignResult.success ? 'success' : 'error'"
          :closable="false"
          show-icon
        >
          <template #default>
            <div class="result-details">
              <p>成功: {{ assignResult.successCount }} 个用户</p>
              <p v-if="assignResult.failedCount > 0">
                失败: {{ assignResult.failedCount }} 个用户
              </p>
              <div v-if="assignResult.errors && assignResult.errors.length > 0" class="error-list">
                <p>失败详情:</p>
                <ul>
                  <li v-for="(error, index) in assignResult.errors" :key="index">
                    {{ error }}
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </el-alert>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose" :disabled="assigning">取消</el-button>
      <el-button
        type="primary"
        :loading="assigning"
        :disabled="assigning || (assignResult !== null)"
        @click="handleSubmit"
      >
        {{ assigning ? '分配中...' : '确定' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { batchAssignGroupsApi, listGroupsApi } from '@/api'
import type { PermissionGroup } from '@/api/types/iam'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'

interface Props {
  visible: boolean
  userIds: number[]
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()
const loading = ref(false)
const loadingGroups = ref(false)
const assigning = ref(false)
const assignedCount = ref(0)
const assignResult = ref<{
  success: boolean
  successCount: number
  failedCount: number
  errors?: string[]
} | null>(null)

const permissionGroups = ref<PermissionGroup[]>([])

const formData = ref({
  groupIds: [] as number[],
  assignMode: 'append' as 'append' | 'replace'
})

const rules: FormRules = {
  groupIds: [
    { required: true, message: '请选择至少一个权限组', trigger: 'change', type: 'array', min: 1 }
  ]
}

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 计算进度
const progress = computed(() => {
  if (props.userIds.length === 0) return 0
  return Math.round((assignedCount.value / props.userIds.length) * 100)
})

const progressStatus = computed(() => {
  if (assignResult.value) {
    return assignResult.value.success ? 'success' : 'exception'
  }
  return undefined
})

// 获取权限组列表
const fetchPermissionGroups = async () => {
  loadingGroups.value = true
  try {
    const { data } = await listGroupsApi({ size: 100 })
    permissionGroups.value = data.groups
  } catch (error) {
    console.error('获取权限组列表失败:', error)
    ElMessage.error('获取权限组列表失败')
  } finally {
    loadingGroups.value = false
  }
}

// 提交批量分配
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  assigning.value = true
  assignedCount.value = 0
  assignResult.value = null

  try {
    // 调用批量分配 API
    await batchAssignGroupsApi({
      user_ids: props.userIds,
      group_ids: formData.value.groupIds,
      mode: formData.value.assignMode
    })

    // 模拟进度更新
    for (let i = 0; i < props.userIds.length; i++) {
      assignedCount.value = i + 1
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    assignResult.value = {
      success: true,
      successCount: props.userIds.length,
      failedCount: 0
    }

    ElMessage.success('批量分配权限组成功')
    
    // 延迟关闭对话框,让用户看到结果
    setTimeout(() => {
      emit('success')
      handleClose()
    }, 1500)
  } catch (error: any) {
    console.error('批量分配失败:', error)
    
    assignResult.value = {
      success: false,
      successCount: 0,
      failedCount: props.userIds.length,
      errors: [error.message || '批量分配失败']
    }
    
    ElMessage.error(error.message || '批量分配失败')
  } finally {
    assigning.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  if (assigning.value) {
    ElMessage.warning('正在分配中,请稍候...')
    return
  }
  
  // 重置表单
  formRef.value?.resetFields()
  formData.value.groupIds = []
  formData.value.assignMode = 'append'
  assignedCount.value = 0
  assignResult.value = null
  
  emit('update:visible', false)
}

// 监听对话框打开
watch(() => props.visible, (visible) => {
  if (visible) {
    fetchPermissionGroups()
  }
})

// 初始化
onMounted(() => {
  if (props.visible) {
    fetchPermissionGroups()
  }
})
</script>

<style scoped lang="scss">
.batch-assign-dialog {
  .user-count-alert {
    margin-bottom: 20px;
  }

  .assign-form {
    margin-top: 20px;

    .group-option {
      display: flex;
      flex-direction: column;
      
      .group-name {
        font-weight: 500;
        color: #303133;
      }
      
      .group-description {
        font-size: 12px;
        color: #909399;
        margin-top: 4px;
      }
    }

    .form-tip {
      margin-top: 8px;
      font-size: 12px;
      color: #909399;
      line-height: 1.5;
    }
  }

  .progress-section {
    margin-top: 20px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 4px;

    .progress-text {
      margin-top: 12px;
      text-align: center;
      font-size: 14px;
      color: #606266;
    }
  }

  .result-section {
    margin-top: 20px;

    .result-details {
      p {
        margin: 4px 0;
      }

      .error-list {
        margin-top: 12px;
        
        ul {
          margin: 8px 0;
          padding-left: 20px;
          
          li {
            margin: 4px 0;
            color: #f56c6c;
          }
        }
      }
    }
  }
}
</style>
