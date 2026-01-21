<template>
  <el-dialog
    v-model="dialogVisible"
    title="导出用户数据"
    width="600px"
    :close-on-click-modal="false"
  >
    <el-form label-width="100px">
      <!-- 导出范围 -->
      <el-form-item label="导出范围">
        <el-radio-group v-model="exportScope">
          <el-radio value="selected" :disabled="selectedUsers.length === 0">
            导出选中的用户 ({{ selectedUsers.length }})
          </el-radio>
          <el-radio value="current">导出当前页 ({{ users.length }})</el-radio>
          <el-radio value="all">导出全部 ({{ totalCount }})</el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 导出字段 -->
      <el-form-item label="导出字段">
        <div class="field-selection">
          <el-checkbox
            v-model="selectAll"
            :indeterminate="isIndeterminate"
            @change="handleSelectAll"
          >
            全选
          </el-checkbox>
          <el-divider />
          <el-checkbox-group v-model="selectedFields">
            <el-checkbox
              v-for="field in availableFields"
              :key="field.value"
              :value="field.value"
            >
              {{ field.label }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </el-form-item>

      <!-- 导出格式 -->
      <el-form-item label="导出格式">
        <el-radio-group v-model="exportFormat">
          <el-radio value="xlsx">Excel (.xlsx)</el-radio>
          <el-radio value="csv">CSV (.csv)</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button
        type="primary"
        :loading="exporting"
        :disabled="selectedFields.length === 0"
        @click="handleExport"
      >
        导出
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { CloudUser } from '@/api/types/iam'
import { getProviderLabel, getUserStatus, getUserTypeLabel } from '@/utils/constants'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'
import * as XLSX from 'xlsx'

interface Props {
  visible: boolean
  users: CloudUser[]
  selectedUsers: CloudUser[]
  totalCount: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

// 可导出的字段
const availableFields = [
  { label: '用户名', value: 'username' },
  { label: '显示名称', value: 'display_name' },
  { label: '用户类型', value: 'user_type' },
  { label: '状态', value: 'status' },
  { label: '云平台', value: 'provider' },
  { label: '云账号', value: 'cloud_account_name' },
  { label: '邮箱', value: 'email' },
  { label: '权限组', value: 'permission_groups' },
  { label: '创建时间', value: 'create_time' },
  { label: '更新时间', value: 'update_time' },
]

// 状态
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

const exportScope = ref<'selected' | 'current' | 'all'>('current')
const selectedFields = ref<string[]>([
  'username',
  'display_name',
  'user_type',
  'status',
  'provider',
  'cloud_account_name',
  'email',
  'permission_groups',
  'create_time',
])
const exportFormat = ref<'xlsx' | 'csv'>('xlsx')
const exporting = ref(false)

// 全选状态
const selectAll = ref(false)
const isIndeterminate = computed(() => {
  const count = selectedFields.value.length
  return count > 0 && count < availableFields.length
})

// 监听选中字段变化
watch(
  () => selectedFields.value.length,
  (count) => {
    selectAll.value = count === availableFields.length
  }
)

// 监听导出范围变化
watch(exportScope, (newScope) => {
  // 如果选择了"导出选中"但没有选中任何用户，自动切换到"导出当前页"
  if (newScope === 'selected' && props.selectedUsers.length === 0) {
    exportScope.value = 'current'
  }
})

// 全选/取消全选
const handleSelectAll = (checked: boolean | string | number) => {
  if (checked) {
    selectedFields.value = availableFields.map((f) => f.value)
  } else {
    selectedFields.value = []
  }
}

// 获取要导出的用户数据
const getExportUsers = (): CloudUser[] => {
  switch (exportScope.value) {
    case 'selected':
      return props.selectedUsers
    case 'current':
      return props.users
    case 'all':
      // TODO: 如果需要导出全部，需要调用 API 获取所有数据
      return props.users
    default:
      return []
  }
}

// 格式化字段值
const formatFieldValue = (user: CloudUser, field: string): string => {
  switch (field) {
    case 'user_type':
      return getUserTypeLabel(user.user_type) || '-'
    case 'status':
      return getUserStatus(user.status)?.label || '-'
    case 'provider':
      return getProviderLabel(user.provider) || '-'
    case 'permission_groups':
      return user.permission_groups?.map((g) => g.name).join(', ') || '-'
    default:
      return (user as any)[field] || '-'
  }
}

// 导出为 Excel
const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '用户数据')
  XLSX.writeFile(wb, filename)
}

// 导出为 CSV
const exportToCSV = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// 执行导出
const handleExport = async () => {
  if (selectedFields.value.length === 0) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  exporting.value = true
  try {
    // 获取要导出的用户
    const exportUsers = getExportUsers()
    if (exportUsers.length === 0) {
      ElMessage.warning('没有可导出的数据')
      return
    }

    // 构建导出数据
    const exportData = exportUsers.map((user) => {
      const row: Record<string, string> = {}
      selectedFields.value.forEach((field) => {
        const fieldConfig = availableFields.find((f) => f.value === field)
        if (fieldConfig) {
          row[fieldConfig.label] = formatFieldValue(user, field)
        }
      })
      return row
    })

    // 生成文件名
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `用户数据_${timestamp}.${exportFormat.value}`

    // 根据格式导出
    if (exportFormat.value === 'xlsx') {
      exportToExcel(exportData, filename)
    } else {
      exportToCSV(exportData, filename)
    }

    ElMessage.success(`成功导出 ${exportUsers.length} 条数据`)
    emit('success')
  } catch (error: any) {
    console.error('Export error:', error)
    ElMessage.error('导出失败：' + (error.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

// 取消
const handleCancel = () => {
  dialogVisible.value = false
}
</script>

<style scoped lang="scss">
.field-selection {
  width: 100%;
  padding: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;

  :deep(.el-checkbox) {
    display: block;
    margin-left: 0;
    margin-right: 0;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(.el-divider) {
    margin: 12px 0;
  }
}
</style>
