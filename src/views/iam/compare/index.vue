<template>
  <div class="permission-compare-page">
    <PageHeader
      title="权限对比"
      description="对比不同云账号的 IAM 用户与权限组差异"
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
          <el-tooltip content="暂未开放" placement="top">
            <span>
              <el-button type="primary" size="small" disabled>
                <el-icon><Download /></el-icon>
                导出对比报告
              </el-button>
            </span>
          </el-tooltip>
        </div>
      </template>

      <!-- 部分账号查询失败提示（不阻塞其它账号） -->
      <el-alert
        v-if="failedAccounts.length > 0"
        :title="`以下账号数据查询失败：${failedAccounts.join('、')}，对应数据以「—」显示`"
        type="warning"
        :closable="false"
        show-icon
        class="load-warning"
      />

      <!-- 概览统计 -->
      <div class="overview-stats">
        <el-row :gutter="16">
          <el-col
            v-for="account in compareData"
            :key="account.accountId"
            :span="24 / compareData.length"
          >
            <template v-for="stat in getOverviewStats(account)" :key="stat.key">
              <el-statistic
                v-if="stat.value !== null"
                :value="stat.value"
                :title="stat.title"
              >
                <template v-if="stat.primary" #prefix>
                  <CloudPlatformTag
                    :provider="account.provider"
                    size="small"
                  />
                </template>
              </el-statistic>
              <!-- 查询失败/未接入：诚实显示「—」，不虚构计数 -->
              <div
                v-else
                class="stat-unavailable"
                :title="`${stat.title}暂无数据`"
              >
                <div class="stat-unavailable__title">{{ stat.title }}</div>
                <div class="stat-unavailable__value">
                  <CloudPlatformTag
                    v-if="stat.primary"
                    :provider="account.provider"
                    size="small"
                  />
                  <span>—</span>
                </div>
              </div>
            </template>
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
                  v-if="row.accounts[account.accountId]?.state === 'exists'"
                  type="success"
                  size="small"
                >
                  存在
                </el-tag>
                <el-tag
                  v-else-if="row.accounts[account.accountId]?.state === 'missing'"
                  type="info"
                  size="small"
                >
                  不存在
                </el-tag>
                <span v-else class="cell-unavailable">—</span>
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
                <div v-if="row.accounts[account.accountId]?.state === 'exists'">
                  <el-tag type="success" size="small">
                    存在
                  </el-tag>
                  <div style="font-size: 12px; color: #999; margin-top: 4px;">
                    {{ row.accounts[account.accountId]?.memberCount ?? 0 }} 个成员
                  </div>
                </div>
                <el-tag
                  v-else-if="row.accounts[account.accountId]?.state === 'missing'"
                  type="info"
                  size="small"
                >
                  不存在
                </el-tag>
                <span v-else class="cell-unavailable">—</span>
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

        <!-- 策略对比：未接入，诚实占位（无 per-account 策略查询接口） -->
        <el-tab-pane label="策略对比" name="policies">
          <el-empty description="策略对比暂未接入">
            <div class="policy-placeholder-tip">
              暂无按云账号维度的策略查询数据，无法提供真实策略对比；接口接入后将在此展示。
            </div>
          </el-empty>
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
import { listCloudAccountsApi, listGroupsApi, listUsersApi } from '@/api'
import type { CloudAccount } from '@/api/types/account'
import type { CloudProvider, CloudUser, PermissionGroup } from '@/api/types/iam'
import CloudPlatformTag from '@/components/CloudPlatformTag.vue'
import PageHeader from '@/components/PageHeader.vue'
import { Download, RefreshLeft, View } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

// 每账号拉取的用户/组行数上限：计数取响应 total，对比行只取首屏行
const COMPARE_FETCH_SIZE = 200

// 数据
const loading = ref(false)
const cloudAccounts = ref<CloudAccount[]>([])
const selectedAccounts = ref<string[]>([])
const activeTab = ref('users')
// 查询失败的账号名（单账号失败降级「—」，不阻塞其它账号）
const failedAccounts = ref<string[]>([])

interface CompareAccountData {
  accountId: string
  accountName: string
  provider: CloudProvider
  /** null = 该账号该数据查询失败/未接入，展示「—」 */
  userCount: number | null
  groupCount: number | null
  /** 策略对比未接入，恒为 null */
  policyCount: number | null
}

const compareData = ref<CompareAccountData[]>([])

type CompareCellState = 'exists' | 'missing' | 'unavailable'

interface UserCompareRow {
  username: string
  accounts: Record<string, { state: CompareCellState; userType?: string }>
}

interface GroupCompareRow {
  groupName: string
  accounts: Record<string, { state: CompareCellState; memberCount?: number }>
}

const userCompareData = ref<UserCompareRow[]>([])
const groupCompareData = ref<GroupCompareRow[]>([])

// 加载云账号列表
const loadCloudAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ page: 1, size: 100 })
    cloudAccounts.value = res.data.accounts || []
  } catch (error) {
    console.error('加载云账号列表失败:', error)
    ElMessage.error('加载云账号列表失败')
  }
}

/** list 接口响应（拦截器归一化后）可能出现的列表载体字段 */
interface ListResPayload<T> {
  data?: T[]
  users?: T[]
  groups?: T[]
  items?: T[]
  total?: number
}

/** 从 list 接口响应提取列表与总数：优先 total 字段，无则取列表长度 */
const extractListPage = <T>(
  res: { data?: ListResPayload<T> | T[] }
): { list: T[]; total: number } => {
  const payload = res?.data
  if (Array.isArray(payload)) {
    return { list: payload, total: payload.length }
  }
  const list = payload?.data ?? payload?.users ?? payload?.groups ?? payload?.items ?? []
  const total = typeof payload?.total === 'number' ? payload.total : list.length
  return { list, total }
}

/** 单账号的用户/组查询结果（failed=true 表示查询失败，展示「—」） */
interface AccountIamData {
  account: CloudAccount
  users: { list: CloudUser[]; total: number; failed: boolean }
  groups: { list: PermissionGroup[]; total: number; failed: boolean }
}

/** 拉取单账号的用户/组数据：users/groups 相互独立，失败不互相影响 */
const fetchAccountIamData = async (account: CloudAccount): Promise<AccountIamData> => {
  const [usersRes, groupsRes] = await Promise.allSettled([
    listUsersApi({ cloud_account_id: account.id, page: 1, size: COMPARE_FETCH_SIZE }),
    listGroupsApi({ cloud_account_id: account.id, page: 1, size: COMPARE_FETCH_SIZE })
  ])

  const users: AccountIamData['users'] = { list: [], total: 0, failed: true }
  if (usersRes.status === 'fulfilled') {
    const page = extractListPage<CloudUser>(usersRes.value)
    users.list = page.list
    users.total = page.total
    users.failed = false
  } else {
    console.error(`账号 ${account.name} 用户列表查询失败:`, usersRes.reason)
  }

  const groups: AccountIamData['groups'] = { list: [], total: 0, failed: true }
  if (groupsRes.status === 'fulfilled') {
    const page = extractListPage<PermissionGroup>(groupsRes.value)
    groups.list = page.list
    groups.total = page.total
    groups.failed = false
  } else {
    console.error(`账号 ${account.name} 权限组列表查询失败:`, groupsRes.reason)
  }

  return { account, users, groups }
}

/** 用户对比行：各账号用户名的并集，按名称排序；失败账号整列 unavailable */
const buildUserCompareRows = (results: AccountIamData[]): UserCompareRow[] => {
  const usernames = new Set<string>()
  results.forEach(result => result.users.list.forEach(user => usernames.add(user.username)))

  return Array.from(usernames)
    .sort((a, b) => a.localeCompare(b))
    .map(username => {
      const accounts: UserCompareRow['accounts'] = {}
      results.forEach(result => {
        const accountId = result.account.id.toString()
        if (result.users.failed) {
          accounts[accountId] = { state: 'unavailable' }
          return
        }
        const user = result.users.list.find(u => u.username === username)
        accounts[accountId] = user
          ? { state: 'exists', userType: user.user_type }
          : { state: 'missing' }
      })
      return { username, accounts }
    })
}

/** 权限组对比行：各账号组名的并集，按名称排序；成员数取 member_count（兼容 user_count） */
const buildGroupCompareRows = (results: AccountIamData[]): GroupCompareRow[] => {
  const groupNames = new Set<string>()
  results.forEach(result => result.groups.list.forEach(group => groupNames.add(group.name)))

  return Array.from(groupNames)
    .sort((a, b) => a.localeCompare(b))
    .map(groupName => {
      const accounts: GroupCompareRow['accounts'] = {}
      results.forEach(result => {
        const accountId = result.account.id.toString()
        if (result.groups.failed) {
          accounts[accountId] = { state: 'unavailable' }
          return
        }
        const group = result.groups.list.find(g => g.name === groupName)
        accounts[accountId] = group
          ? { state: 'exists', memberCount: group.member_count ?? group.user_count ?? 0 }
          : { state: 'missing' }
      })
      return { groupName, accounts }
    })
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

  const accounts = selectedAccounts.value
    .map(id => cloudAccounts.value.find(account => account.id.toString() === String(id)))
    .filter((account): account is CloudAccount => account !== undefined)

  if (accounts.length < 2) {
    ElMessage.error('云账号信息缺失，请刷新页面后重试')
    return
  }

  loading.value = true
  failedAccounts.value = []
  try {
    // 每账号独立查询（≤4 账号 × 用户/组 = ≤8 请求），单账号失败降级不阻塞
    const results = await Promise.all(accounts.map(account => fetchAccountIamData(account)))

    compareData.value = results.map(({ account, users, groups }) => ({
      accountId: account.id.toString(),
      accountName: account.name,
      provider: account.provider,
      userCount: users.failed ? null : users.total,
      groupCount: groups.failed ? null : groups.total,
      // 无 per-account 策略查询接口，策略对比未接入，不虚构数据
      policyCount: null
    }))
    failedAccounts.value = results
      .filter(({ users, groups }) => users.failed || groups.failed)
      .map(({ account }) => account.name)

    userCompareData.value = buildUserCompareRows(results)
    groupCompareData.value = buildGroupCompareRows(results)
  } catch (error) {
    console.error('加载对比数据失败:', error)
    ElMessage.error('加载对比数据失败')
  } finally {
    loading.value = false
  }
}

interface OverviewStat {
  key: string
  title: string
  value: number | null
  /** 是否在数值前展示云平台标签（首个统计项） */
  primary?: boolean
}

// 概览统计项：策略数量恒为「—」（策略对比未接入，无真实数据源）
const getOverviewStats = (account: CompareAccountData): OverviewStat[] => [
  { key: 'users', title: '用户数量', value: account.userCount, primary: true },
  { key: 'groups', title: '权限组数量', value: account.groupCount },
  { key: 'policies', title: '策略数量', value: null }
]

// 重置对比
const resetCompare = () => {
  selectedAccounts.value = []
  compareData.value = []
  userCompareData.value = []
  groupCompareData.value = []
  failedAccounts.value = []
  activeTab.value = 'users'
}

// 查看用户详情
const viewUserDetail = (row: UserCompareRow) => {
  ElMessage.info(`用户「${row.username}」详情功能开发中`)
}

// 查看权限组详情
const viewGroupDetail = (row: GroupCompareRow) => {
  ElMessage.info(`权限组「${row.groupName}」详情功能开发中`)
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

    .load-warning {
      margin-bottom: 16px;
    }

    .overview-stats {
      margin-bottom: 20px;

      .el-statistic + .el-statistic,
      .el-statistic + .stat-unavailable,
      .stat-unavailable + .el-statistic,
      .stat-unavailable + .stat-unavailable {
        margin-top: 16px;
      }

      .stat-unavailable {
        .stat-unavailable__title {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          margin-bottom: 4px;
        }

        .stat-unavailable__value {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 24px;
          font-weight: 600;
          color: var(--el-text-color-secondary);
        }
      }
    }
  }

  .cell-unavailable {
    color: var(--el-text-color-secondary);
  }

  .policy-placeholder-tip {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}
</style>
