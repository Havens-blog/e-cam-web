<template>
  <div class="permission-compare-page">
    <PageHeader
      title="权限对比"
      description="对比不同云平台的权限策略差异"
    />

    <el-card class="filter-card">
      <el-form :inline="true">
        <el-form-item label="选择云账号">
          <el-select
            v-model="selectedAccounts"
            multiple
            placeholder="请选择要对比的云账号（2-4个）"
            style="width: 400px"
            :max-collapse-tags="2"
            collapse-tags
            collapse-tags-tooltip
          >
            <el-option
              v-for="account in cloudAccounts"
              :key="account.id"
              :label="account.name"
              :value="account.id"
            >
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>{{ account.name }}</span>
                <CloudPlatformTag
                  :provider="account.provider"
                  size="small"
                  :show-label="false"
                />
              </div>
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :disabled="selectedAccounts.length < 2"
            :loading="loading"
            @click="loadCompareData"
          >
            <el-icon><View /></el-icon>
            开始对比
          </el-button>
          <el-button @click="resetCompare">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="selectedAccounts.length > 0 && selectedAccounts.length < 2"
        title="请至少选择 2 个云账号进行对比"
        type="warning"
        :closable="false"
        show-icon
      />
      <el-alert
        v-if="selectedAccounts.length > 4"
        title="最多只能选择 4 个云账号进行对比"
        type="error"
        :closable="false"
        show-icon
      />
    </el-card>

    <!-- 对比结果 -->
    <el-card v-if="compareData.length > 0" class="compare-card">
      <template #header>
        <div class="card-header">
          <span>权限对比结果</span>
          <el-button
            type="primary"
            size="small"
            @click="exportCompare"
          >
            <el-icon><Download /></el-icon>
            导出对比报告
          </el-button>
        </div>
      </template>

      <!-- 概览统计 -->
      <div class="overview-stats">
        <el-row :gutter="16">
          <el-col
            v-for="account in compareData"
            :key="account.accountId"
            :span="24 / compareData.length"
          >
            <el-statistic :value="account.userCount" title="用户数量">
              <template #prefix>
                <CloudPlatformTag
                  :provider="account.provider"
                  size="small"
                />
              </template>
            </el-statistic>
            <el-statistic
              :value="account.groupCount"
              title="权限组数量"
              style="margin-top: 16px"
            />
            <el-statistic
              :value="account.policyCount"
              title="策略数量"
              style="margin-top: 16px"
            />
          </el-col>
        </el-row>
      </div>

      <el-divider />

      <!-- 详细对比表格 -->
      <el-tabs v-model="activeTab" type="border-card">
        <!-- 用户对比 -->
        <el-tab-pane label="用户对比" name="users">
          <el-table
            :data="userCompareData"
            border
            stripe
            style="width: 100%"
          >
            <el-table-column prop="username" label="用户名" width="200" fixed />
            <el-table-column
              v-for="account in compareData"
              :key="account.accountId"
              :label="account.accountName"
              align="center"
            >
              <template #header>
                <div>
                  <div>{{ account.accountName }}</div>
                  <CloudPlatformTag
                    :provider="account.provider"
                    size="small"
                    style="margin-top: 4px"
                  />
                </div>
              </template>
              <template #default="{ row }">
                <el-tag
                  v-if="row.accounts[account.accountId]"
                  type="success"
                  size="small"
                >
                  存在
                </el-tag>
                <el-tag v-else type="info" size="small">
                  不存在
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="viewUserDetail(row)"
                >
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 权限组对比 -->
        <el-tab-pane label="权限组对比" name="groups">
          <el-table
            :data="groupCompareData"
            border
            stripe
            style="width: 100%"
          >
            <el-table-column prop="groupName" label="权限组名称" width="200" fixed />
            <el-table-column
              v-for="account in compareData"
              :key="account.accountId"
              :label="account.accountName"
              align="center"
            >
              <template #header>
                <div>
                  <div>{{ account.accountName }}</div>
                  <CloudPlatformTag
                    :provider="account.provider"
                    size="small"
                    style="margin-top: 4px"
                  />
                </div>
              </template>
              <template #default="{ row }">
                <div v-if="row.accounts[account.accountId]">
                  <el-tag type="success" size="small">
                    存在
                  </el-tag>
                  <div style="font-size: 12px; color: #999; margin-top: 4px;">
                    {{ row.accounts[account.accountId].memberCount }} 个成员
                  </div>
                </div>
                <el-tag v-else type="info" size="small">
                  不存在
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="viewGroupDetail(row)"
                >
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 策略对比 -->
        <el-tab-pane label="策略对比" name="policies">
          <el-table
            :data="policyCompareData"
            border
            stripe
            style="width: 100%"
          >
            <el-table-column prop="policyName" label="策略名称" width="200" fixed />
            <el-table-column prop="policyType" label="策略类型" width="120" />
            <el-table-column
              v-for="account in compareData"
              :key="account.accountId"
              :label="account.accountName"
              align="center"
            >
              <template #header>
                <div>
                  <div>{{ account.accountName }}</div>
                  <CloudPlatformTag
                    :provider="account.provider"
                    size="small"
                    style="margin-top: 4px"
                  />
                </div>
              </template>
              <template #default="{ row }">
                <div v-if="row.accounts[account.accountId]">
                  <el-tag type="success" size="small">
                    存在
                  </el-tag>
                  <div style="font-size: 12px; color: #999; margin-top: 4px;">
                    {{ row.accounts[account.accountId].attachmentCount }} 个附加
                  </div>
                </div>
                <el-tag v-else type="info" size="small">
                  不存在
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button
                  type="primary"
                  size="small"
                  link
                  @click="viewPolicyDetail(row)"
                >
                  查看详情
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 空状态 -->
    <el-empty
      v-if="!loading && compareData.length === 0"
      description="请选择云账号开始对比"
    />
  </div>
</template>

<script setup lang="ts">
import { listCloudAccountsApi } from '@/api'
import type { CloudAccount } from '@/api/types/account'
import type { CloudProvider } from '@/api/types/iam'
import CloudPlatformTag from '@/components/CloudPlatformTag.vue'
import PageHeader from '@/components/PageHeader.vue'
import { Download, RefreshLeft, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

// 数据
const loading = ref(false)
const cloudAccounts = ref<CloudAccount[]>([])
const selectedAccounts = ref<string[]>([])
const activeTab = ref('users')

interface CompareAccountData {
  accountId: string
  accountName: string
  provider: CloudProvider
  userCount: number
  groupCount: number
  policyCount: number
}

const compareData = ref<CompareAccountData[]>([])

interface UserCompareRow {
  username: string
  accounts: Record<string, { exists: boolean; userType?: string }>
}

interface GroupCompareRow {
  groupName: string
  accounts: Record<string, { exists: boolean; memberCount?: number }>
}

interface PolicyCompareRow {
  policyName: string
  policyType: string
  accounts: Record<string, { exists: boolean; attachmentCount?: number }>
}

const userCompareData = ref<UserCompareRow[]>([])
const groupCompareData = ref<GroupCompareRow[]>([])
const policyCompareData = ref<PolicyCompareRow[]>([])

// 加载云账号列表
const loadCloudAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ page: 1, page_size: 100 })
    cloudAccounts.value = res.data.accounts || []
  } catch (error) {
    console.error('加载云账号列表失败:', error)
    ElMessage.error('加载云账号列表失败')
  }
}

// 加载对比数据
const loadCompareData = async () => {
  if (selectedAccounts.value.length < 2) {
    ElMessage.warning('请至少选择 2 个云账号')
    return
  }

  if (selectedAccounts.value.length > 4) {
    ElMessage.warning('最多只能选择 4 个云账号')
    return
  }

  loading.value = true
  try {
    // 模拟数据加载
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 构建对比数据
    compareData.value = selectedAccounts.value.map(accountId => {
      const account = cloudAccounts.value.find(a => a.id.toString() === accountId)!
      return {
        accountId: account.id.toString(),
        accountName: account.name,
        provider: account.provider,
        userCount: Math.floor(Math.random() * 100) + 10,
        groupCount: Math.floor(Math.random() * 20) + 5,
        policyCount: Math.floor(Math.random() * 50) + 10
      }
    })

    // 构建用户对比数据
    userCompareData.value = generateUserCompareData()
    groupCompareData.value = generateGroupCompareData()
    policyCompareData.value = generatePolicyCompareData()

    ElMessage.success('对比数据加载成功')
  } catch (error) {
    console.error('加载对比数据失败:', error)
    ElMessage.error('加载对比数据失败')
  } finally {
    loading.value = false
  }
}

// 生成用户对比数据
const generateUserCompareData = (): UserCompareRow[] => {
  const users = ['admin', 'developer', 'operator', 'viewer', 'auditor']
  return users.map(username => {
    const accounts: Record<string, { exists: boolean; userType?: string }> = {}
    compareData.value.forEach(account => {
      accounts[account.accountId] = {
        exists: Math.random() > 0.3,
        userType: 'iam_user'
      }
    })
    return { username, accounts }
  })
}

// 生成权限组对比数据
const generateGroupCompareData = (): GroupCompareRow[] => {
  const groups = ['管理员组', '开发者组', '运维组', '只读组', '审计组']
  return groups.map(groupName => {
    const accounts: Record<string, { exists: boolean; memberCount?: number }> = {}
    compareData.value.forEach(account => {
      const exists = Math.random() > 0.3
      accounts[account.accountId] = {
        exists,
        memberCount: exists ? Math.floor(Math.random() * 20) + 1 : undefined
      }
    })
    return { groupName, accounts }
  })
}

// 生成策略对比数据
const generatePolicyCompareData = (): PolicyCompareRow[] => {
  const policies = [
    { name: 'AdministratorAccess', type: '系统策略' },
    { name: 'ReadOnlyAccess', type: '系统策略' },
    { name: 'PowerUserAccess', type: '系统策略' },
    { name: 'CustomDeveloperPolicy', type: '自定义策略' },
    { name: 'CustomAuditorPolicy', type: '自定义策略' }
  ]
  return policies.map(policy => {
    const accounts: Record<string, { exists: boolean; attachmentCount?: number }> = {}
    compareData.value.forEach(account => {
      const exists = Math.random() > 0.3
      accounts[account.accountId] = {
        exists,
        attachmentCount: exists ? Math.floor(Math.random() * 10) + 1 : undefined
      }
    })
    return {
      policyName: policy.name,
      policyType: policy.type,
      accounts
    }
  })
}

// 重置对比
const resetCompare = () => {
  selectedAccounts.value = []
  compareData.value = []
  userCompareData.value = []
  groupCompareData.value = []
  policyCompareData.value = []
  activeTab.value = 'users'
}

// 导出对比报告
const exportCompare = () => {
  ElMessage.success('对比报告导出功能开发中')
}

// 查看用户详情
const viewUserDetail = (row: UserCompareRow) => {
  console.log('查看用户详情:', row)
  ElMessage.info('用户详情功能开发中')
}

// 查看权限组详情
const viewGroupDetail = (row: GroupCompareRow) => {
  console.log('查看权限组详情:', row)
  ElMessage.info('权限组详情功能开发中')
}

// 查看策略详情
const viewPolicyDetail = (row: PolicyCompareRow) => {
  console.log('查看策略详情:', row)
  ElMessage.info('策略详情功能开发中')
}

onMounted(() => {
  loadCloudAccounts()
})
</script>

<style scoped lang="scss">
.permission-compare-page {
  padding: 20px;

  .filter-card {
    margin-bottom: 20px;
  }

  .compare-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .overview-stats {
      margin-bottom: 20px;
    }
  }
}
</style>
