<template>
  <PageContainer>
    <div class="records-page">
      <!-- 面包屑 -->
      <div class="breadcrumb-bar">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/network/dns' }">DNS 管理</el-breadcrumb-item>
          <el-breadcrumb-item>{{ domain }}</el-breadcrumb-item>
          <el-breadcrumb-item>解析记录</el-breadcrumb-item>
        </el-breadcrumb>
      </div>

      <div class="page-header">
        <div class="page-title">
          <el-button text @click="router.push('/network/dns')">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          {{ domain }} — 解析记录
        </div>
      </div>

      <RecordTable
        ref="recordTableRef"
        :domain="domain"
        @add="handleAdd"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
      />

      <!-- 创建/编辑对话框 -->
      <RecordFormDialog
        v-model:visible="formDialogVisible"
        :domain="domain"
        :account-id="editAccountId"
        :record="editRecord"
        @success="handleFormSuccess"
      />

      <!-- 删除确认对话框 -->
      <RecordDeleteDialog
        ref="deleteDialogRef"
        v-model:visible="deleteDialogVisible"
        :records="deleteRecords"
        @confirm="handleDeleteConfirm"
      />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import { batchDeleteDnsRecordsApi, deleteDnsRecordApi } from '@/api/dns'
import type { DnsRecord } from '@/api/types/dns'
import PageContainer from '@/components/PageContainer/index.vue'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RecordDeleteDialog from './components/RecordDeleteDialog.vue'
import RecordFormDialog from './components/RecordFormDialog.vue'
import RecordTable from './components/RecordTable.vue'

const route = useRoute()
const router = useRouter()
const domain = (route.params.domain as string) || ''

const recordTableRef = ref<InstanceType<typeof RecordTable>>()
const deleteDialogRef = ref<InstanceType<typeof RecordDeleteDialog>>()

// Form dialog state
const formDialogVisible = ref(false)
const editRecord = ref<DnsRecord | null>(null)
const editAccountId = ref(0)

// Delete dialog state
const deleteDialogVisible = ref(false)
const deleteRecords = ref<DnsRecord[]>([])

const handleAdd = () => {
  editRecord.value = null
  editAccountId.value = 0
  formDialogVisible.value = true
}

const handleEdit = (record: DnsRecord) => {
  editRecord.value = record
  editAccountId.value = record?.account_id || 0
  formDialogVisible.value = true
}

const handleDelete = (record: DnsRecord) => {
  deleteRecords.value = [record]
  deleteDialogVisible.value = true
}

const handleBatchDelete = (records: DnsRecord[]) => {
  deleteRecords.value = records
  deleteDialogVisible.value = true
}

const handleFormSuccess = () => {
  recordTableRef.value?.refresh()
}

const handleDeleteConfirm = async () => {
  deleteDialogRef.value?.setLoading(true)
  try {
    if (deleteRecords.value.length === 1) {
      const rec = deleteRecords.value[0]
      await deleteDnsRecordApi(domain, rec?.record_id || '')
      ElMessage.success('删除成功')
    } else {
      const ids = deleteRecords.value
        .filter(r => r != null)
        .map(r => r.record_id)
      const res = await batchDeleteDnsRecordsApi(domain, { record_ids: ids })
      const data = (res as any).data || res
      if (data?.failed_count > 0) {
        ElMessage.warning(`成功 ${data.success_count} 条，失败 ${data.failed_count} 条`)
      } else {
        ElMessage.success(`成功删除 ${data?.success_count || ids.length} 条记录`)
      }
    }
    deleteDialogVisible.value = false
    recordTableRef.value?.refresh()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '删除失败'
    ElMessage.error(msg)
  } finally {
    deleteDialogRef.value?.setLoading(false)
  }
}
</script>

<style scoped lang="scss">
.records-page {
  padding: 24px 32px;
}

.breadcrumb-bar {
  margin-bottom: 16px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
