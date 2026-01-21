<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑租户' : '创建租户'"
    width="800px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="120px"
    >
      <el-tabs v-model="activeTab">
        <!-- 基本信息 -->
        <el-tab-pane label="基本信息" name="basic">
          <el-form-item label="租户ID" prop="id">
            <el-input
              v-model="formData.id"
              placeholder="请输入租户ID"
              :disabled="isEdit"
            />
            <div class="form-item-tip">租户的唯一标识，创建后不可修改</div>
          </el-form-item>

          <el-form-item label="租户名称" prop="name">
            <el-input v-model="formData.name" placeholder="请输入租户名称" />
          </el-form-item>

          <el-form-item label="显示名称" prop="display_name">
            <el-input v-model="formData.display_name" placeholder="请输入显示名称" />
          </el-form-item>

          <el-form-item label="描述" prop="description">
            <el-input
              v-model="formData.description"
              type="textarea"
              :rows="3"
              placeholder="请输入描述信息"
            />
          </el-form-item>

          <el-form-item v-if="isEdit" label="状态" prop="status">
            <el-select v-model="formData.status" placeholder="请选择状态">
              <el-option
                v-for="status in TENANT_STATUS.filter(s => s.value !== 'deleted')"
                :key="status.value"
                :label="status.label"
                :value="status.value"
              />
            </el-select>
          </el-form-item>
        </el-tab-pane>

        <!-- 元数据 -->
        <el-tab-pane label="元数据" name="metadata">
          <el-form-item label="公司名称">
            <el-input v-model="formData.metadata.company_name" placeholder="请输入公司名称" />
          </el-form-item>

          <el-form-item label="联系邮箱">
            <el-input v-model="formData.metadata.contact_email" placeholder="请输入联系邮箱" />
          </el-form-item>

          <el-form-item label="联系电话">
            <el-input v-model="formData.metadata.contact_phone" placeholder="请输入联系电话" />
          </el-form-item>

          <el-form-item label="负责人">
            <el-input v-model="formData.metadata.owner" placeholder="请输入负责人" />
          </el-form-item>

          <el-form-item label="行业">
            <el-select v-model="formData.metadata.industry" placeholder="请选择行业">
              <el-option
                v-for="industry in INDUSTRIES"
                :key="industry.value"
                :label="industry.label"
                :value="industry.value"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="地区">
            <el-select v-model="formData.metadata.region" placeholder="请选择地区">
              <el-option
                v-for="region in REGIONS"
                :key="region.value"
                :label="region.label"
                :value="region.value"
              />
            </el-select>
          </el-form-item>
        </el-tab-pane>

        <!-- 配置设置 -->
        <el-tab-pane label="配置设置" name="settings">
          <el-form-item label="最大用户数">
            <el-input-number
              v-model="formData.settings.max_users"
              :min="0"
              :max="10000"
              placeholder="请输入最大用户数"
            />
          </el-form-item>

          <el-form-item label="最大用户组数">
            <el-input-number
              v-model="formData.settings.max_user_groups"
              :min="0"
              :max="1000"
              placeholder="请输入最大用户组数"
            />
          </el-form-item>

          <el-form-item label="最大云账号数">
            <el-input-number
              v-model="formData.settings.max_cloud_accounts"
              :min="0"
              :max="100"
              placeholder="请输入最大云账号数"
            />
          </el-form-item>

          <el-form-item label="允许的云平台">
            <el-select
              v-model="formData.settings.allowed_providers"
              multiple
              placeholder="请选择允许的云平台"
            >
              <el-option
                v-for="provider in CLOUD_PROVIDERS"
                :key="provider.value"
                :label="provider.label"
                :value="provider.value"
              />
            </el-select>
          </el-form-item>
        </el-tab-pane>
      </el-tabs>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { createTenantApi, updateTenantApi } from '@/api/iam'
import type { CreateTenantRequest, Tenant, UpdateTenantRequest } from '@/api/types/iam'
import { INDUSTRIES, REGIONS, TENANT_STATUS } from '@/utils/constants'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'

const CLOUD_PROVIDERS = [
  { value: 'aliyun', label: '阿里云' },
  { value: 'aws', label: 'AWS' },
  { value: 'azure', label: 'Azure' },
  { value: 'tencent', label: '腾讯云' },
  { value: 'huawei', label: '华为云' }
]

interface Props {
  visible: boolean
  tenant?: Tenant
  isEdit: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const formRef = ref<FormInstance>()
const activeTab = ref('basic')
const submitting = ref(false)

// 表单数据
const formData = reactive({
  id: '',
  name: '',
  display_name: '',
  description: '',
  status: 'active' as any,
  metadata: {
    company_name: '',
    contact_email: '',
    contact_phone: '',
    owner: '',
    industry: '',
    region: '',
    tags: {},
    user_count: 0,
    user_group_count: 0,
    cloud_account_count: 0
  },
  settings: {
    max_users: 100,
    max_user_groups: 50,
    max_cloud_accounts: 10,
    allowed_providers: [] as any[],
    features: {},
    custom_fields: {}
  }
})

// 表单验证规则
const formRules: FormRules = {
  id: [
    { required: true, message: '请输入租户ID', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: '只能包含字母、数字、下划线和连字符', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入租户名称', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' }
  ]
}

// 重置表单
const resetForm = () => {
  formData.id = ''
  formData.name = ''
  formData.display_name = ''
  formData.description = ''
  formData.status = 'active'
  formData.metadata = {
    company_name: '',
    contact_email: '',
    contact_phone: '',
    owner: '',
    industry: '',
    region: '',
    tags: {},
    user_count: 0,
    user_group_count: 0,
    cloud_account_count: 0
  }
  formData.settings = {
    max_users: 100,
    max_user_groups: 50,
    max_cloud_accounts: 10,
    allowed_providers: [],
    features: {},
    custom_fields: {}
  }
  formRef.value?.clearValidate()
  activeTab.value = 'basic'
}

// 监听 tenant 变化，初始化表单数据
watch(
  () => props.tenant,
  (tenant) => {
    if (tenant) {
      formData.id = tenant.id
      formData.name = tenant.name
      formData.display_name = tenant.display_name
      formData.description = tenant.description
      formData.status = tenant.status
      formData.metadata = { ...tenant.metadata }
      formData.settings = { ...tenant.settings }
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

// 关闭对话框
const handleClose = () => {
  dialogVisible.value = false
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    submitting.value = true

    if (props.isEdit) {
      // 编辑租户
      const updateData: UpdateTenantRequest = {
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description,
        status: formData.status,
        metadata: formData.metadata,
        settings: formData.settings
      }
      await updateTenantApi(formData.id, updateData)
      ElMessage.success('更新成功')
    } else {
      // 创建租户
      const createData: CreateTenantRequest = {
        id: formData.id,
        name: formData.name,
        display_name: formData.display_name,
        description: formData.description,
        metadata: formData.metadata,
        settings: formData.settings
      }
      await createTenantApi(createData)
      ElMessage.success('创建成功')
    }

    emit('success')
    handleClose()
  } catch (error: any) {
    console.error('提交失败:', error)
    if (error.message) {
      ElMessage.error(error.message)
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.form-item-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

:deep(.el-tabs__content) {
  max-height: 500px;
  overflow-y: auto;
}
</style>
