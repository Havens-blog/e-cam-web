<template>
  <div class="policy-editor">
    <div class="editor-header">
      <span class="policy-count">已添加 {{ policies.length }} 个策略</span>
      <el-button size="small" @click="handleAddPolicy">
        <el-icon><Plus /></el-icon>
        添加策略
      </el-button>
    </div>

    <div v-if="policies.length > 0" class="policies-list">
      <el-card
        v-for="(policy, index) in policies"
        :key="index"
        class="policy-card"
        shadow="hover"
      >
        <div class="policy-header">
          <div class="policy-info">
            <span class="policy-name">{{ policy.policy_name || '未命名策略' }}</span>
            <el-tag size="small" :type="policy.policy_type === 'system' ? 'success' : 'info'">
              {{ policy.policy_type === 'system' ? '系统策略' : '自定义策略' }}
            </el-tag>
            <CloudPlatformTag :provider="policy.provider" size="small" />
          </div>
          <el-button
            link
            type="danger"
            size="small"
            @click="handleRemovePolicy(index)"
          >
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
        <div class="policy-content">
          <el-input
            v-model="policy.policy_document"
            type="textarea"
            :rows="4"
            placeholder="请输入策略文档（JSON格式）"
            :readonly="readonly"
          />
        </div>
      </el-card>
    </div>

    <el-empty v-else description="暂无策略，点击上方按钮添加" :image-size="80" />

    <!-- 添加策略对话框 -->
    <el-dialog
      v-model="addDialogVisible"
      title="添加权限策略"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="newPolicy" :rules="policyRules" ref="policyFormRef" label-width="100px">
        <el-form-item label="云平台" prop="provider">
          <el-select
            v-model="newPolicy.provider"
            placeholder="请选择云平台"
            style="width: 100%"
            :disabled="providers.length === 1"
          >
            <el-option
              v-for="p in availableProviders"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="策略类型" prop="policy_type">
          <el-radio-group v-model="newPolicy.policy_type">
            <el-radio value="system">系统策略</el-radio>
            <el-radio value="custom">自定义策略</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="策略ID" prop="policy_id">
          <el-input
            v-model="newPolicy.policy_id"
            placeholder="请输入策略ID"
            maxlength="200"
          />
        </el-form-item>

        <el-form-item label="策略名称" prop="policy_name">
          <el-input
            v-model="newPolicy.policy_name"
            placeholder="请输入策略名称"
            maxlength="200"
          />
        </el-form-item>

        <el-form-item label="策略文档" prop="policy_document">
          <el-input
            v-model="newPolicy.policy_document"
            type="textarea"
            :rows="8"
            placeholder="请输入策略文档（JSON格式）"
          />
          <div class="form-tip">
            请输入符合云平台规范的策略文档，通常为JSON格式
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirmAdd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { PermissionPolicy } from '@/api/types/iam'
import CloudPlatformTag from '@/components/CloudPlatformTag.vue'
import { CLOUD_PROVIDERS } from '@/utils/constants'
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

interface Props {
  policies: PermissionPolicy[]
  providers: string[]
  readonly?: boolean
}

interface Emits {
  (e: 'update:policies', value: PermissionPolicy[]): void
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

const emit = defineEmits<Emits>()

const addDialogVisible = ref(false)
const policyFormRef = ref<FormInstance>()

const newPolicy = reactive<PermissionPolicy>({
  policy_id: '',
  policy_name: '',
  policy_type: 'system',
  policy_document: '',
  provider: '' as any
})

const policyRules: FormRules = {
  provider: [{ required: true, message: '请选择云平台', trigger: 'change' }],
  policy_id: [{ required: true, message: '请输入策略ID', trigger: 'blur' }],
  policy_name: [{ required: true, message: '请输入策略名称', trigger: 'blur' }],
  policy_document: [{ required: true, message: '请输入策略文档', trigger: 'blur' }]
}

// 可用的云平台
const availableProviders = computed(() => {
  if (props.providers.length === 0) {
    return CLOUD_PROVIDERS
  }
  return CLOUD_PROVIDERS.filter(p => props.providers.includes(p.value))
})

// 添加策略
const handleAddPolicy = () => {
  // 如果只有一个云平台，自动选择
  if (props.providers.length === 1) {
    newPolicy.provider = props.providers[0] as any
  } else {
    newPolicy.provider = '' as any
  }
  
  newPolicy.policy_id = ''
  newPolicy.policy_name = ''
  newPolicy.policy_type = 'system'
  newPolicy.policy_document = ''
  
  addDialogVisible.value = true
}

// 确认添加
const handleConfirmAdd = async () => {
  if (!policyFormRef.value) return

  try {
    await policyFormRef.value.validate()
    
    const updatedPolicies = [...props.policies, { ...newPolicy }]
    emit('update:policies', updatedPolicies)
    
    ElMessage.success('添加策略成功')
    addDialogVisible.value = false
  } catch (error) {
    console.error('表单验证失败:', error)
  }
}

// 删除策略
const handleRemovePolicy = (index: number) => {
  const updatedPolicies = props.policies.filter((_, i) => i !== index)
  emit('update:policies', updatedPolicies)
  ElMessage.success('删除策略成功')
}

// 监听 providers 变化
watch(() => props.providers, (newProviders) => {
  // 如果云平台变化，移除不匹配的策略
  if (newProviders.length > 0) {
    const validPolicies = props.policies.filter(p => newProviders.includes(p.provider))
    if (validPolicies.length !== props.policies.length) {
      emit('update:policies', validPolicies)
    }
  }
})
</script>

<style scoped lang="scss">
.policy-editor {
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    
    .policy-count {
      font-size: 14px;
      color: #606266;
      font-weight: 500;
    }
  }

  .policies-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    
    .policy-card {
      .policy-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        
        .policy-info {
          display: flex;
          align-items: center;
          gap: 8px;
          
          .policy-name {
            font-weight: 600;
            color: #303133;
          }
        }
      }
      
      .policy-content {
        :deep(.el-textarea__inner) {
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }
      }
    }
  }

  .form-tip {
    margin-top: 8px;
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
  }
}
</style>
