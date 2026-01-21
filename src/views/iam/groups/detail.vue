<template>
  <PageContainer>
    <ManagerHeader
      title="权限组详情"
      :subtitle="group?.name || `权限组 ID: ${groupId}`"
      show-back-button
      @back="handleBack"
      @refresh="handleRefresh"
    >
      <template #actions>
        <el-button @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" @click="handleDelete">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </template>
    </ManagerHeader>

    <div v-loading="loading" class="detail-content">
      <!-- 基本信息 -->
      <el-card class="info-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span>基本信息</span>
          </div>
        </template>
        
        <el-descriptions :column="2" border>
          <el-descriptions-item label="权限组名称">
            <span class="detail-value">{{ group?.name || '-' }}</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="成员数量">
            <el-tag size="small" type="success">
              {{ group?.member_count || 0 }} 个用户
            </el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="描述" :span="2">
            <span class="detail-value">{{ group?.description || '-' }}</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="云平台" :span="2">
            <div v-if="group?.cloud_platforms && group.cloud_platforms.length > 0" class="platforms-tags">
              <CloudPlatformTag
                v-for="provider in group.cloud_platforms"
                :key="provider"
                :provider="provider"
                size="small"
                class="platform-tag"
              />
            </div>
            <span v-else>-</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="创建时间">
            <span class="detail-value">{{ group?.create_time ? formatDateTime(group.create_time) : '-' }}</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="更新时间">
            <span class="detail-value">{{ group?.update_time ? formatDateTime(group.update_time) : '-' }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <!-- 权限策略 -->
      <el-card class="policies-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span>权限策略 ({{ group?.policies?.length || 0 }})</span>
            <el-button size="small" @click="handleEditPolicies">
              <el-icon><Edit /></el-icon>
              编辑策略
            </el-button>
          </div>
        </template>
        
        <div v-if="group?.policies && group.policies.length > 0" class="policies-list">
          <el-card
            v-for="(policy, index) in group.policies"
            :key="index"
            class="policy-card"
            shadow="hover"
          >
            <div class="policy-header">
              <div class="policy-info">
                <span class="policy-name">{{ policy.policy_name }}</span>
                <el-tag size="small" :type="policy.policy_type === 'system' ? 'success' : 'info'">
                  {{ policy.policy_type === 'system' ? '系统策略' : '自定义策略' }}
                </el-tag>
                <CloudPlatformTag :provider="policy.provider" size="small" />
              </div>
              <span class="policy-id">ID: {{ policy.policy_id }}</span>
            </div>
            <div class="policy-document">
              <el-input
                :model-value="policy.policy_document"
                type="textarea"
                :rows="4"
                readonly
              />
            </div>
          </el-card>
        </div>
        
        <el-empty v-else description="暂无权限策略" :image-size="80" />
      </el-card>

      <!-- 成员列表 -->
      <el-card class="members-card" shadow="never">
        <template #header>
          <div class="card-header">
            <span>成员列表 ({{ members.length }})</span>
            <el-button size="small" @click="handleManageMembers">
              <el-icon><UserFilled /></el-icon>
              管理成员
            </el-button>
          </div>
        </template>
        
        <el-table v-if="members.length > 0" :data="members" stripe>
          <el-table-column prop="username" label="用户名" min-width="120" />
          <el-table-column prop="display_name" label="显示名称" min-width="120" />
          <el-table-column prop="user_type" label="用户类型" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ getUserTypeLabel(row.user_type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.status" :type="getUserStatus(row.status).color as any" size="small">
                {{ getUserStatus(row.status).label }}
              </el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="email" label="邮箱" min-width="180" />
        </el-table>
        
        <el-empty v-else description="暂无成员" :image-size="80" />
      </el-card>
    </div>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑权限组"
      width="800px"
      :close-on-click-modal="false"
    >
      <GroupForm ref="formRef" :group="group" :is-edit="true" />
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmitEdit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </PageContainer>
</template>

<script setup lang="ts">
import { deleteGroupApi, getGroupDetailApi } from '@/api'
import type { CloudUser, PermissionGroup } from '@/api/types/iam'
import CloudPlatformTag from '@/components/CloudPlatformTag.vue'
import ManagerHeader from '@/components/ManagerHeader/index.vue'
import PageContainer from '@/components/PageContainer/index.vue'
import { getUserStatus, getUserTypeLabel } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import { Delete, Edit, UserFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GroupForm from './components/GroupForm.vue'

const route = useRoute()
const router = useRouter()

const groupId = computed(() => Number(route.params.id))
const loading = ref(false)
const group = ref<PermissionGroup | null>(null)
const members = ref<CloudUser[]>([])

const editDialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<InstanceType<typeof GroupForm>>()

// 获取权限组详情
const fetchGroupDetail = async () => {
  loading.value = true
  try {
    const { data } = await getGroupDetailApi(groupId.value)
    group.value = data
    // TODO: 获取成员列表
    members.value = []
  } catch (error: any) {
    console.error('获取权限组详情失败:', error)
    ElMessage.error(error.message || '获取权限组详情失败')
  } finally {
    loading.value = false
  }
}

// 返回列表
const handleBack = () => {
  router.push('/iam/groups')
}

// 刷新
const handleRefresh = () => {
  fetchGroupDetail()
}

// 编辑权限组
const handleEdit = () => {
  editDialogVisible.value = true
}

// 提交编辑
const handleSubmitEdit = async () => {
  if (!formRef.value) return

  try {
    submitting.value = true
    await formRef.value.submit()
    ElMessage.success('更新权限组成功')
    editDialogVisible.value = false
    fetchGroupDetail()
  } catch (error: any) {
    console.error('更新权限组失败:', error)
    ElMessage.error(error.message || '更新权限组失败')
  } finally {
    submitting.value = false
  }
}

// 删除权限组
const handleDelete = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该权限组吗？此操作不可恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await deleteGroupApi(groupId.value)
    ElMessage.success('删除成功')
    router.push('/iam/groups')
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除权限组失败:', error)
      ElMessage.error(error.message || '删除权限组失败')
    }
  }
}

// 编辑策略
const handleEditPolicies = () => {
  editDialogVisible.value = true
}

// 管理成员
const handleManageMembers = () => {
  // TODO: 实现管理成员功能
  ElMessage.info('管理成员功能开发中')
}

// 初始化
onMounted(() => {
  fetchGroupDetail()
})
</script>

<style scoped lang="scss">
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .info-card,
  .policies-card,
  .members-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }
  }

  .detail-value {
    font-weight: 500;
    color: #303133;
  }

  .platforms-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .platform-tag {
      margin-bottom: 4px;
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

        .policy-id {
          font-size: 12px;
          color: #909399;
        }
      }

      .policy-document {
        :deep(.el-textarea__inner) {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          background: #f5f7fa;
        }
      }
    }
  }
}
</style>
