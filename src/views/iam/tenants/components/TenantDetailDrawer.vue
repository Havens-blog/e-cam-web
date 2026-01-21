<template>
  <el-drawer
    v-model="drawerVisible"
    title="租户详情"
    size="600px"
    :close-on-click-modal="false"
  >
    <div v-loading="loading" class="tenant-detail">
      <template v-if="tenant">
        <!-- 操作按钮 -->
        <div class="action-bar">
          <el-button type="primary" @click="handleEdit">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button type="danger" @click="handleDelete">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
          <el-button @click="loadTenantStats">
            <el-icon><Refresh /></el-icon>
            刷新统计
          </el-button>
        </div>

        <!-- 基本信息 -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>基本信息</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="租户ID">{{ tenant.id }}</el-descriptions-item>
            <el-descriptions-item label="租户名称">{{ tenant.name }}</el-descriptions-item>
            <el-descriptions-item label="显示名称">{{ tenant.display_name }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="getTenantStatus(tenant.status)?.color as any">
                {{ getTenantStatus(tenant.status)?.label }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">
              {{ tenant.description || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ tenant.create_time }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ tenant.update_time }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 元数据信息 -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>元数据信息</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="公司名称">
              {{ tenant.metadata.company_name || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="负责人">
              {{ tenant.metadata.owner || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="联系邮箱">
              {{ tenant.metadata.contact_email || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="联系电话">
              {{ tenant.metadata.contact_phone || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="行业">
              {{ getIndustryLabel(tenant.metadata.industry) }}
            </el-descriptions-item>
            <el-descriptions-item label="地区">
              {{ getRegionLabel(tenant.metadata.region) }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 统计信息 -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>资源统计</span>
            </div>
          </template>
          <div v-if="stats" class="stats-container">
            <div class="stat-item">
              <div class="stat-label">用户数</div>
              <div class="stat-value">
                <span class="current">{{ stats.current_users }}</span>
                <span class="separator">/</span>
                <span class="max">{{ stats.max_users }}</span>
              </div>
              <el-progress
                :percentage="getPercentage(stats.current_users, stats.max_users)"
                :status="getProgressStatus(stats.current_users, stats.max_users)"
              />
            </div>

            <div class="stat-item">
              <div class="stat-label">用户组数</div>
              <div class="stat-value">
                <span class="current">{{ stats.current_user_groups }}</span>
                <span class="separator">/</span>
                <span class="max">{{ stats.max_user_groups }}</span>
              </div>
              <el-progress
                :percentage="getPercentage(stats.current_user_groups, stats.max_user_groups)"
                :status="getProgressStatus(stats.current_user_groups, stats.max_user_groups)"
              />
            </div>

            <div class="stat-item">
              <div class="stat-label">云账号数</div>
              <div class="stat-value">
                <span class="current">{{ stats.current_cloud_accounts }}</span>
                <span class="separator">/</span>
                <span class="max">{{ stats.max_cloud_accounts }}</span>
              </div>
              <el-progress
                :percentage="getPercentage(stats.current_cloud_accounts, stats.max_cloud_accounts)"
                :status="getProgressStatus(stats.current_cloud_accounts, stats.max_cloud_accounts)"
              />
            </div>
          </div>
          <el-empty v-else description="暂无统计数据" />
        </el-card>

        <!-- 配置设置 -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>配置设置</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="最大用户数">
              {{ tenant.settings.max_users }}
            </el-descriptions-item>
            <el-descriptions-item label="最大用户组数">
              {{ tenant.settings.max_user_groups }}
            </el-descriptions-item>
            <el-descriptions-item label="最大云账号数">
              {{ tenant.settings.max_cloud_accounts }}
            </el-descriptions-item>
            <el-descriptions-item label="允许的云平台" :span="2">
              <el-tag
                v-for="provider in tenant.settings.allowed_providers"
                :key="provider"
                style="margin-right: 8px"
              >
                {{ getProviderLabel(provider) }}
              </el-tag>
              <span v-if="!tenant.settings.allowed_providers.length">-</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 快速跳转 -->
        <el-card class="info-card" shadow="never">
          <template #header>
            <div class="card-header">
              <span>快速跳转</span>
            </div>
          </template>
          <div class="quick-links">
            <el-button @click="goToUsers">
              <el-icon><User /></el-icon>
              查看用户列表
            </el-button>
            <el-button @click="goToGroups">
              <el-icon><UserFilled /></el-icon>
              查看权限组列表
            </el-button>
            <el-button @click="goToAccounts">
              <el-icon><Connection /></el-icon>
              查看云账号列表
            </el-button>
          </div>
        </el-card>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { getTenantDetailApi, getTenantStatsApi } from '@/api/iam'
import type { Tenant, TenantStats } from '@/api/types/iam'
import { getIndustryLabel, getRegionLabel, getTenantStatus } from '@/utils/constants'
import { Connection, Delete, Edit, Refresh, User, UserFilled } from '@element-plus/icons-vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

interface Props {
  visible: boolean
  tenantId: string
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'edit', tenant: Tenant): void
  (e: 'delete', tenant: Tenant): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const router = useRouter()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const loading = ref(false)
const tenant = ref<Tenant>()
const stats = ref<TenantStats>()

// 加载租户详情
const loadTenantDetail = async () => {
  if (!props.tenantId) return

  loading.value = true
  try {
    const res = await getTenantDetailApi(props.tenantId)
    tenant.value = res.data
    await loadTenantStats()
  } catch (error) {
    console.error('加载租户详情失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载租户统计信息
const loadTenantStats = async () => {
  if (!props.tenantId) return

  try {
    const res = await getTenantStatsApi(props.tenantId)
    stats.value = res.data
  } catch (error) {
    console.error('加载租户统计信息失败:', error)
  }
}

// 监听 tenantId 变化
watch(
  () => props.tenantId,
  () => {
    if (props.visible && props.tenantId) {
      loadTenantDetail()
    }
  },
  { immediate: true }
)

// 计算百分比
const getPercentage = (current: number, max: number): number => {
  if (max === 0) return 0
  return Math.min(Math.round((current / max) * 100), 100)
}

// 获取进度条状态
const getProgressStatus = (current: number, max: number): 'success' | 'warning' | 'exception' | undefined => {
  const percentage = getPercentage(current, max)
  if (percentage >= 100) return 'exception'
  if (percentage >= 80) return 'warning'
  return 'success'
}

// 获取云平台标签
const getProviderLabel = (provider: string): string => {
  const labels: Record<string, string> = {
    aliyun: '阿里云',
    aws: 'AWS',
    azure: 'Azure',
    tencent: '腾讯云',
    huawei: '华为云'
  }
  return labels[provider] || provider
}

// 编辑租户
const handleEdit = () => {
  if (tenant.value) {
    emit('edit', tenant.value)
  }
}

// 删除租户
const handleDelete = () => {
  if (tenant.value) {
    emit('delete', tenant.value)
  }
}

// 跳转到用户列表
const goToUsers = () => {
  router.push({
    path: '/iam/users',
    query: { tenant_id: props.tenantId }
  })
}

// 跳转到权限组列表
const goToGroups = () => {
  router.push({
    path: '/iam/groups',
    query: { tenant_id: props.tenantId }
  })
}

// 跳转到云账号列表
const goToAccounts = () => {
  router.push({
    path: '/accounts',
    query: { tenant_id: props.tenantId }
  })
}
</script>

<style scoped lang="scss">
.tenant-detail {
  .action-bar {
    margin-bottom: 16px;
    display: flex;
    gap: 8px;
  }

  .info-card {
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .card-header {
      font-weight: 600;
    }
  }

  .stats-container {
    .stat-item {
      margin-bottom: 24px;

      &:last-child {
        margin-bottom: 0;
      }

      .stat-label {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 8px;

        .current {
          color: var(--el-color-primary);
        }

        .separator {
          margin: 0 8px;
          color: var(--el-text-color-secondary);
        }

        .max {
          color: var(--el-text-color-regular);
          font-size: 18px;
        }
      }
    }
  }

  .quick-links {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .el-button {
      justify-content: flex-start;
    }
  }
}
</style>
