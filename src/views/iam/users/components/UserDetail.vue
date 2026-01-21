<template>
  <div v-loading="loading" class="user-detail">
    <el-descriptions :column="2" border>
      <el-descriptions-item label="用户名">
        <span class="detail-value">{{ user?.username || '-' }}</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="显示名称">
        <span class="detail-value">{{ user?.display_name || '-' }}</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="用户类型">
        <el-tag v-if="user && user.user_type" size="small">{{ getUserTypeLabel(user.user_type) }}</el-tag>
        <span v-else>-</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="状态">
        <template v-if="user && user.status">
          <el-tag :type="getUserStatus(user.status).color as any" size="small">
            {{ getUserStatus(user.status).label }}
          </el-tag>
        </template>
        <span v-else>-</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="云平台">
        <CloudPlatformTag v-if="user?.provider" :provider="user.provider" size="small" />
        <span v-else>-</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="云账号">
        <span class="detail-value">{{ user?.cloud_account_name || '-' }}</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="邮箱">
        <span class="detail-value">{{ user?.email || '-' }}</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="租户ID">
        <span class="detail-value">{{ user?.tenant_id || '-' }}</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="创建时间">
        <span class="detail-value">{{ safeFormatDateTime(user?.create_time) }}</span>
      </el-descriptions-item>
      
      <el-descriptions-item label="更新时间">
        <span class="detail-value">{{ safeFormatDateTime(user?.update_time) }}</span>
      </el-descriptions-item>
    </el-descriptions>

    <!-- 权限组列表 -->
    <div class="permission-groups-section">
      <div class="section-header">
        <h3>权限组</h3>
        <el-button size="small" @click="handleManageGroups">
          <el-icon><Setting /></el-icon>
          管理权限组
        </el-button>
      </div>
      
      <div v-if="user?.permission_groups && user.permission_groups.length > 0" class="groups-list">
        <el-card
          v-for="group in user.permission_groups"
          :key="group.id"
          class="group-card"
          shadow="hover"
        >
          <div class="group-info">
            <div class="group-name">{{ group.name }}</div>
            <div class="group-description">{{ group.description || '暂无描述' }}</div>
            <div class="group-meta">
              <el-tag size="small" type="info">
                {{ group.policies?.length || 0 }} 个策略
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>
      
      <el-empty v-else description="暂无权限组" :image-size="80" />
    </div>

    <!-- 操作按钮 -->
    <div class="action-buttons">
      <el-button type="primary" @click="handleEdit">
        <el-icon><Edit /></el-icon>
        编辑用户
      </el-button>
      <el-button @click="handleChangeStatus">
        <el-icon><Switch /></el-icon>
        修改状态
      </el-button>
      <el-button type="danger" @click="handleDelete">
        <el-icon><Delete /></el-icon>
        删除用户
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CloudUser } from '@/api/types/iam'
import CloudPlatformTag from '@/components/CloudPlatformTag.vue'
import { getUserStatus, getUserTypeLabel } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import { Delete, Edit, Setting, Switch } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, ref } from 'vue'

// 安全的格式化函数
const safeFormatDateTime = (dateTime: string | undefined) => {
  return dateTime ? formatDateTime(dateTime) : '-'
}

interface Props {
  userId: number
}

interface Emits {
  (e: 'edit', user: CloudUser): void
  (e: 'delete', user: CloudUser): void
  (e: 'change-status', user: CloudUser): void
  (e: 'manage-groups', user: CloudUser): void
  (e: 'refresh'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const loading = ref(false)
const user = ref<CloudUser | null>(null)

// 获取用户详情
const fetchUserDetail = async () => {
  loading.value = true
  try {
    // TODO: 调用获取用户详情的 API
    // const { data } = await getUserDetailApi(props.userId)
    // user.value = data
    
    // 临时模拟数据
    console.log('获取用户详情:', props.userId)
  } catch (error) {
    console.error('获取用户详情失败:', error)
    ElMessage.error('获取用户详情失败')
  } finally {
    loading.value = false
  }
}

// 编辑用户
const handleEdit = () => {
  if (user.value) {
    emit('edit', user.value)
  }
}

// 删除用户
const handleDelete = async () => {
  if (!user.value) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${user.value.username}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    emit('delete', user.value)
  } catch (error) {
    // 用户取消
  }
}

// 修改状态
const handleChangeStatus = () => {
  if (user.value) {
    emit('change-status', user.value)
  }
}

// 管理权限组
const handleManageGroups = () => {
  if (user.value) {
    emit('manage-groups', user.value)
  }
}

// 刷新数据
const refresh = () => {
  fetchUserDetail()
}

// 暴露方法
defineExpose({
  refresh
})

// 初始化
onMounted(() => {
  fetchUserDetail()
})
</script>

<style scoped lang="scss">
.user-detail {
  .detail-value {
    font-weight: 500;
    color: #303133;
  }

  .permission-groups-section {
    margin-top: 24px;
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }
    }
    
    .groups-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      
      .group-card {
        .group-info {
          .group-name {
            font-size: 16px;
            font-weight: 600;
            color: #303133;
            margin-bottom: 8px;
          }
          
          .group-description {
            font-size: 14px;
            color: #606266;
            margin-bottom: 12px;
            line-height: 1.5;
          }
          
          .group-meta {
            display: flex;
            gap: 8px;
          }
        }
      }
    }
  }

  .action-buttons {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid #ebeef5;
    display: flex;
    gap: 12px;
  }
}
</style>
