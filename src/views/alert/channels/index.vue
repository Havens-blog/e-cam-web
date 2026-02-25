<template>
  <div class="vm-page">
    <div class="page-top">
      <div class="page-title-row">
        <h1 class="page-title">通知渠道</h1>
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
          <el-icon><Plus /></el-icon> 新建渠道
        </el-button>
      </div>
      <div class="action-right">
        <el-select v-model="filterType" placeholder="全部类型" clearable size="small" style="width: 140px" @change="fetchData">
          <el-option label="钉钉" value="dingtalk" />
          <el-option label="企业微信" value="wecom" />
          <el-option label="飞书" value="feishu" />
          <el-option label="邮件" value="email" />
        </el-select>
        <el-button size="small" circle @click="fetchData" title="刷新">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="table-wrapper">
      <el-table :data="list" v-loading="loading" stripe style="width: 100%">
        <el-table-column prop="name" label="渠道名称" min-width="160" />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="channelTagType(row.type)">{{ channelTypeLabel(row.type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="创建时间" width="180">
          <template #default="{ row }">{{ formatTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleTest(row)">测试</el-button>
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-popconfirm title="确定删除该渠道？" @confirm="handleDelete(row)">
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

    <ChannelFormDialog v-model="showForm" :edit-data="editData" @success="fetchData" />
  </div>
</template>

<script setup lang="ts">
import type { AlertChannel, ChannelType } from '@/api/alert'
import { deleteChannelApi, listChannelsApi, testChannelApi } from '@/api/alert'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import ChannelFormDialog from './components/ChannelFormDialog.vue'

const list = ref<AlertChannel[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filterType = ref<ChannelType | ''>('')
const showForm = ref(false)
const editData = ref<AlertChannel | null>(null)

const channelTypeLabel = (t: string) => {
  const m: Record<string, string> = { dingtalk: '钉钉', wecom: '企业微信', feishu: '飞书', email: '邮件' }
  return m[t] || t
}
const channelTagType = (t: string) => {
  const m: Record<string, string> = { dingtalk: '', wecom: 'success', feishu: 'warning', email: 'info' }
  return (m[t] || '') as any
}
const formatTime = (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-'

const fetchData = async () => {
  loading.value = true
  try {
    const params: any = { offset: (page.value - 1) * pageSize, limit: pageSize }
    if (filterType.value) params.type = filterType.value
    const res = await listChannelsApi(params)
    list.value = (res as any).data?.items || []
    total.value = (res as any).data?.total || 0
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

const handleEdit = (row: AlertChannel) => {
  editData.value = row
  showForm.value = true
}

const handleDelete = async (row: AlertChannel) => {
  try {
    await deleteChannelApi(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e: any) {
    ElMessage.error(e.message || '删除失败')
  }
}

const handleTest = async (row: AlertChannel) => {
  try {
    await testChannelApi(row.id)
    ElMessage.success('测试消息已发送')
  } catch (e: any) {
    ElMessage.error(e.message || '测试失败')
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
