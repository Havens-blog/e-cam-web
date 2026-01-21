<template>
  <el-form ref="formRef" :model="formData" :rules="rules" label-width="120px">
    <el-form-item label="用户名" prop="username">
      <el-input
        v-model="formData.username"
        placeholder="请输入用户名"
        :disabled="isEdit"
        maxlength="100"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="显示名称" prop="display_name">
      <el-input
        v-model="formData.display_name"
        placeholder="请输入显示名称"
        maxlength="200"
        show-word-limit
      />
    </el-form-item>

    <el-form-item label="用户类型" prop="user_type">
      <el-select
        v-model="formData.user_type"
        placeholder="请选择用户类型"
        :disabled="isEdit"
        style="width: 100%"
      >
        <el-option
          v-for="t in USER_TYPES"
          :key="t.value"
          :label="t.label"
          :value="t.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="云账号" prop="cloud_account_id">
      <el-select
        v-model="formData.cloud_account_id"
        placeholder="请选择云账号"
        :disabled="isEdit"
        style="width: 100%"
        @change="handleAccountChange"
      >
        <el-option
          v-for="account in cloudAccounts"
          :key="account.id"
          :label="`${account.name} (${getProviderLabel(account.provider)})`"
          :value="account.id"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="邮箱" prop="email">
      <el-input
        v-model="formData.email"
        placeholder="请输入邮箱"
        type="email"
      />
    </el-form-item>

    <el-form-item v-if="isEdit" label="状态" prop="status">
      <el-select
        v-model="formData.status"
        placeholder="请选择状态"
        style="width: 100%"
      >
        <el-option
          v-for="s in USER_STATUS"
          :key="s.value"
          :label="s.label"
          :value="s.value"
        />
      </el-select>
    </el-form-item>

    <el-form-item label="权限组" prop="permission_groups">
      <el-select
        v-model="formData.permission_groups"
        multiple
        placeholder="请选择权限组"
        style="width: 100%"
      >
        <el-option
          v-for="group in permissionGroups"
          :key="group.id"
          :label="group.name"
          :value="group.id"
        />
      </el-select>
    </el-form-item>
  </el-form>
</template>


<script setup lang="ts">
import { createUserApi, listCloudAccountsApi, listGroupsApi, updateUserApi } from '@/api'
import type { CloudUser } from '@/api/types/iam'
import { getProviderLabel, USER_STATUS, USER_TYPES } from '@/utils/constants'
import type { FormInstance, FormRules } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

interface Props {
  user?: CloudUser | null
  isEdit: boolean
  tenantId?: string
}

const props = defineProps<Props>()

const formRef = ref<FormInstance>()
const cloudAccounts = ref<any[]>([])
const permissionGroups = ref<any[]>([])

const formData = reactive({
  username: '',
  display_name: '',
  user_type: '' as any,
  cloud_account_id: null as number | null,
  email: '',
  status: 'active' as any,
  permission_groups: [] as number[],
  tenant_id: 'default',
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' },
  ],
  display_name: [
    { max: 200, message: '长度不能超过 200 个字符', trigger: 'blur' },
  ],
  user_type: [{ required: true, message: '请选择用户类型', trigger: 'change' }],
  cloud_account_id: [{ required: true, message: '请选择云账号', trigger: 'change' }],
  email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }],
}

// 获取云账号列表
const fetchCloudAccounts = async () => {
  try {
    const { data } = await listCloudAccountsApi({ limit: 100 })
    cloudAccounts.value = data.accounts
  } catch (error) {
    console.error('获取云账号列表失败:', error)
  }
}

// 获取权限组列表
const fetchPermissionGroups = async () => {
  if (!props.tenantId) {
    return
  }
  
  try {
    const { data } = await listGroupsApi({ 
      tenant_id: props.tenantId,
      size: 100 
    })
    permissionGroups.value = data.data || []
  } catch (error) {
    console.error('获取权限组列表失败:', error)
  }
}

// 云账号变化
const handleAccountChange = () => {
  // 可以根据云账号筛选权限组
}

// 初始化表单数据
const initFormData = () => {
  if (props.user) {
    formData.username = props.user.username
    formData.display_name = props.user.display_name
    formData.user_type = props.user.user_type
    formData.cloud_account_id = props.user.cloud_account_id
    formData.email = props.user.email
    formData.status = props.user.status
    formData.permission_groups = props.user.permission_groups?.map((g) => g.id) || []
    formData.tenant_id = props.user.tenant_id
  }
}

// 提交表单
const submit = async () => {
  if (!formRef.value) return

  await formRef.value.validate()

  if (props.isEdit && props.user) {
    await updateUserApi(props.user.id, {
      display_name: formData.display_name,
      email: formData.email,
      status: formData.status,
      permission_groups: formData.permission_groups,
    })
  } else {
    await createUserApi({
      username: formData.username,
      display_name: formData.display_name,
      user_type: formData.user_type,
      cloud_account_id: formData.cloud_account_id!,
      email: formData.email,
      permission_groups: formData.permission_groups,
      tenant_id: formData.tenant_id,
    })
  }
}

// 重置表单
const reset = () => {
  formRef.value?.resetFields()
  formData.username = ''
  formData.display_name = ''
  formData.user_type = ''
  formData.cloud_account_id = null
  formData.email = ''
  formData.status = 'active'
  formData.permission_groups = []
  formData.tenant_id = 'default'
}

// 暴露方法
defineExpose({
  submit,
  reset,
})

// 初始化
onMounted(() => {
  fetchCloudAccounts()
  fetchPermissionGroups()
  initFormData()
})
</script>

<style scoped lang="scss">
:deep(.el-form-item__label) {
  font-weight: 500;
}
</style>
