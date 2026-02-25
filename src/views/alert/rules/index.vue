<template>
  <div class="vm-page">
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">告警规则</h1>
        <div class="stats-badges">
          <div class="stat-badge">
            <span class="stat-label">总数</span>
            <span class="stat-num">{{ total }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <div class="action-left">
        <el-button type="primary" size="small" @click="showForm = true; editData = null">
          <el-icon><Plus /></el-icon> 新建规则
        </el-button>
      </div>
      <div class="action-right">
        <el-select v-model="filterType" placeholder="全部类型" clearable size="small" style="width: 150px" @change="fetchData">
          <el-option label="资源变更" value="resource_change" />
          <el-option label="同步失败" value="sync_failure" />
          <el-option label="资源过期" value="expiration" />
          <el-option label="安全组变更" value="security_group" />
        </el-select>
        <el-button size="small" circle @click="fetchData" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="table-wrapper">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="name" label="规则名称" min-width="180" />
        <el-table-column prop="type" label="告警类型" width="130">
          <template #default="{ row }">
            <el-tag size="small">{{ ruleTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="通知渠道" width="100">
          <template #default="{ row }">
            <span>{{ (row.channel_ids || []).length }} 个</span>
          </template>
        </el-table-column>
        <el-table-column label="资源类型" min-width="160">
          <template #default="{ row }">
            <template v-if="row.resource_types && row.resource_types.length">
              <el-tag v-for="rt in row.resource_types" :key="rt" size="small" style="margin-right: 4px">{{ rt }}</el-tag>
            </template>
            <span v-else style="color: #909399">全部</span>
          </template>
        </el-table-column>
        <el-table-column label="静默期" width="100">
          <template #default="{ row }">{{ row.silence_duration || 0 }} 分钟</template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用" width="80">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" size="small" @change="handleToggle(row)" />
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="创建时间" width="180">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-popconfirm title="确定删除该规则？" @confirm="handleDelete(row)">
              <template #reference>
                <el-button link type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        small
        @current-change="fetchData"
      />
    </div>

    <RuleFormDialog v-model="showForm" :edit-data="editData" @success="fetchData" />
  </div>
</template>

<script setup lang="ts">
import type { AlertRule, AlertRuleType } from '@/api/alert'
import { deleteRuleApi, listRulesApi, toggleRuleApi } from '@/api/alert'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import RuleFormDialog from './components/RuleFormDialog.vue'

const list = ref<AlertRule[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filterType = ref<AlertRuleType | ''>('')
const showForm = ref(false)
const editData = ref<AlertRule | null>(null)

const ruleTypeLabel = (t: string) => {
  const m: Record<string, string> = {
    resource_change: '资源变更', sync_failure: '同步失败',
    expiration: '资源过期', security_group: '安全组变更',
  }
  return m[t] || t
}
const formatTime = (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-'

const fetchData = async () => {
  loading.value = true
  try {
    const params: any = { offset: (page.value - 1) * pageSize, limit: pageSize }
    if (filterType.value) params.type = filterType.value
    const res = await listRulesApi(params)
    list.value = (res as any).data?.items || []
    total.value = (res as any).data?.total || 0
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const handleEdit = (row: AlertRule) => { editData.value = row; showForm.value = true }

const handleDelete = async (row: AlertRule) => {
  try {
    await deleteRuleApi(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e: any) { ElMessage.error(e.message || '删除失败') }
}

const handleToggle = async (row: AlertRule) => {
  try {
    await toggleRuleApi(row.id, row.enabled)
    ElMessage.success(row.enabled ? '已启用' : '已禁用')
  } catch (e: any) {
    row.enabled = !row.enabled
    ElMessage.error(e.message || '操作失败')
  }
}

onMounted(() => fetchData())
</script>

<style lang="scss" scoped>
.vm-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.page-top {
  background: var(--glass-bg, #fff);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 12px;
  padding: 16px 20px;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #303133);
  margin: 0;
}
.stats-badges {
  display: flex;
  gap: 12px;
  margin-left: auto;
}
.stat-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--bg-secondary, #f5f7fa);
  border-radius: 20px;
  font-size: 13px;
}
.stat-label { color: var(--text-secondary, #909399); }
.stat-num { font-weight: 600; color: var(--text-primary, #303133); }
.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--glass-bg, #fff);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 8px;
}
.action-left, .action-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-wrapper {
  flex: 1;
  background: var(--glass-bg, #fff);
  border: 1px solid var(--glass-border, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
}
.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0;
}
</style>
