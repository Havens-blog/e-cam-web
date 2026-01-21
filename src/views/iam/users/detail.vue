<template>
  <PageContainer>
    <ManagerHeader
      title="用户详情"
      :subtitle="`用户 ID: ${userId}`"
      show-back-button
      @back="handleBack"
      @refresh="handleRefresh"
    >
      <template #actions>
        <el-button @click="() => handleEdit()">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" @click="() => handleDelete()">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </template>
    </ManagerHeader>

    <div class="detail-content">
      <UserDetail
        ref="detailRef"
        :user-id="userId"
        @edit="handleEdit"
        @delete="handleDelete"
        @change-status="handleChangeStatus"
        @manage-groups="handleManageGroups"
      />
    </div>

    <!-- 编辑用户对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑用户"
      width="600px"
      :close-on-click-modal="false"
    >
      <UserForm ref="formRef" :user="currentUser" :is-edit="true" />
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitEdit">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 修改状态对话框 -->
    <el-dialog
      v-model="statusDialogVisible"
      title="修改用户状态"
      width="400px"
    >
      <el-form label-width="80px">
        <el-form-item label="状态">
          <el-select v-model="selectedStatus" placeholder="请选择状态" style="width: 100%">
            <el-option
              v-for="s in USER_STATUS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitStatus">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 管理权限组对话框 -->
    <el-dialog
      v-model="groupsDialogVisible"
      title="管理权限组"
      width="500px"
    >
      <el-form label-width="100px">
        <el-form-item label="权限组">
          <el-select
            v-model="selectedGroups"
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
      <template #footer>
        <el-button @click="groupsDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitGroups">
          确定
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import { deleteUserApi, listGroupsApi, updateUserApi } from '@/api'
import type { CloudUser } from '@/api/types/iam'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { USER_STATUS } from '@/utils/constants'
import { Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UserDetail from './components/UserDetail.vue'
import UserForm from './components/UserForm.vue'

const route = useRoute()
const router = useRouter()

const userId = computed(() => Number(route.params.id))
const detailRef = ref<InstanceType<typeof UserDetail>>()
const formRef = ref<InstanceType<typeof UserForm>>()

const editDialogVisible = ref(false)
const statusDialogVisible = ref(false)
const groupsDialogVisible = ref(false)
const submitting = ref(false)

const currentUser = ref<CloudUser | null>(null)
const selectedStatus = ref('')
const selectedGroups = ref<number[]>([])
const permissionGroups = ref<any[]>([])

// 返回列表
const handleBack = () => {
  router.push('/iam/users')
}

// 刷新
const handleRefresh = () => {
  detailRef.value?.refresh()
}

// 编辑用户
const handleEdit = (user?: CloudUser) => {
  if (user) {
    currentUser.value = user
  }
  editDialogVisible.value = true
}

// 提交编辑
const handleSubmitEdit = async () => {
  if (!formRef.value) return
  
  try {
    submitting.value = true
    await formRef.value.submit()
    ElMessage.success('更新用户成功')
    editDialogVisible.value = false
    handleRefresh()
  } catch (error: any) {
    console.error('更新用户失败:', error)
    ElMessage.error(error.message || '更新用户失败')
  } finally {
    submitting.value = false
  }
}

// 删除用户
const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该用户吗？此操作不可恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await deleteUserApi(userId.value)
    ElMessage.success('删除成功')
    router.push('/iam/users')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除用户失败:', error)
      ElMessage.error(error.message || '删除用户失败')
    }
  }
}

// 修改状态
const handleChangeStatus = (user: CloudUser) => {
  currentUser.value = user
  selectedStatus.value = user.status
  statusDialogVisible.value = true
}

// 提交状态修改
const handleSubmitStatus = async () => {
  if (!currentUser.value) return
  
  try {
    submitting.value = true
    await updateUserApi(currentUser.value.id, {
      status: selectedStatus.value as any
    })
    ElMessage.success('状态修改成功')
    statusDialogVisible.value = false
    handleRefresh()
  } catch (error: any) {
    console.error('修改状态失败:', error)
    ElMessage.error(error.message || '修改状态失败')
  } finally {
    submitting.value = false
  }
}

// 管理权限组
const handleManageGroups = (user: CloudUser) => {
  currentUser.value = user
  selectedGroups.value = user.permission_groups.map(g => g.id)
  groupsDialogVisible.value = true
  fetchPermissionGroups()
}

// 获取权限组列表
const fetchPermissionGroups = async () => {
  try {
    const { data } = await listGroupsApi({ size: 100 })
    permissionGroups.value = data.groups
  } catch (error) {
    console.error('获取权限组列表失败:', error)
  }
}

// 提交权限组修改
const handleSubmitGroups = async () => {
  if (!currentUser.value) return
  
  try {
    submitting.value = true
    await updateUserApi(currentUser.value.id, {
      permission_groups: selectedGroups.value
    })
    ElMessage.success('权限组修改成功')
    groupsDialogVisible.value = false
    handleRefresh()
  } catch (error: any) {
    console.error('修改权限组失败:', error)
    ElMessage.error(error.message || '修改权限组失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.detail-content {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 24px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
</style>

