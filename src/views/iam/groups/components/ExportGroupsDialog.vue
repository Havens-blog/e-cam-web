<template>
  <el-dialog
    v-model="dialogVisible"
    title="导出用户组"
    width="600px"
    :close-on-click-modal="false"
  >
    <el-form :model="formData" label-width="100px">
      <el-form-item label="导出范围">
        <el-radio-group v-model="formData.exportType">
          <el-radio value="all">全部用户组 ({{ totalCount }} 个)</el-radio>
          <el-radio value="selected" :disabled="selectedGroups.length === 0">
            已选用户组 ({{ selectedGroups.length }} 个)
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="导出格式">
        <el-radio-group v-model="formData.format">
          <el-radio value="csv">CSV</el-radio>
          <el-radio value="json">JSON</el-radio>
          <el-radio value="excel">Excel</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="导出字段">
        <el-checkbox-group v-model="formData.fields">
          <el-checkbox
            v-for="field in availableFields"
            :key="field.value"
            :value="field.value"
          >
            {{ field.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item label="详细信息">
        <el-checkbox-group v-model="formData.includeDetails">
          <el-checkbox value="policies">包含权限策略</el-checkbox>
          <el-checkbox value="members">包含成员列表</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="exporting" @click="handleExport">
        导出
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { getGroupMembersApi } from '@/api'
import type { CloudUser, PermissionGroup } from '@/api/types/iam'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'

interface Props {
  visible: boolean
  groups: PermissionGroup[]
  selectedGroups: PermissionGroup[]
  totalCount: number
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const exporting = ref(false)

const formData = reactive({
  exportType: 'all' as 'all' | 'selected',
  format: 'csv' as 'csv' | 'json' | 'excel',
  fields: ['name', 'description', 'cloud_platforms', 'member_count', 'create_time'],
  includeDetails: [] as string[]
})

const availableFields = [
  { label: '用户组名称', value: 'name' },
  { label: '描述', value: 'description' },
  { label: '云平台', value: 'cloud_platforms' },
  { label: '成员数量', value: 'member_count' },
  { label: '租户ID', value: 'tenant_id' },
  { label: '创建时间', value: 'create_time' },
  { label: '更新时间', value: 'update_time' }
]

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 获取用户组成员
const fetchGroupMembers = async (groupId: number, tenantId?: string): Promise<CloudUser[]> => {
  try {
    const response = await getGroupMembersApi(groupId, tenantId)
    return Array.isArray(response.data) ? response.data : []
  } catch (error) {
    console.error(`获取用户组 ${groupId} 成员失败:`, error)
    return []
  }
}

// 导出数据
const handleExport = async () => {
  if (formData.fields.length === 0) {
    ElMessage.warning('请至少选择一个导出字段')
    return
  }

  exporting.value = true

  try {
    // 确定要导出的数据
    let dataToExport = formData.exportType === 'all' 
      ? props.groups 
      : props.selectedGroups

    if (dataToExport.length === 0) {
      ElMessage.warning('没有可导出的数据')
      return
    }

    // 如果需要包含成员列表，获取成员数据
    if (formData.includeDetails.includes('members')) {
      const groupsWithMembers = await Promise.all(
        dataToExport.map(async (group) => {
          const members = await fetchGroupMembers(group.id, group.tenant_id)
          return { ...group, members }
        })
      )
      dataToExport = groupsWithMembers
    }

    // 根据格式导出
    if (formData.format === 'csv') {
      exportAsCSV(dataToExport)
    } else if (formData.format === 'json') {
      exportAsJSON(dataToExport)
    } else if (formData.format === 'excel') {
      exportAsExcel(dataToExport)
    }

    ElMessage.success('导出成功')
    emit('success')
    dialogVisible.value = false
  } catch (error: any) {
    console.error('导出失败:', error)
    ElMessage.error(error.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

// 导出为 CSV
const exportAsCSV = (data: any[]) => {
  // 构建 CSV 头部
  const headers = [...formData.fields.map(field => {
    const fieldConfig = availableFields.find(f => f.value === field)
    return fieldConfig?.label || field
  })]

  // 添加详细信息列
  if (formData.includeDetails.includes('policies')) {
    headers.push('权限策略')
  }
  if (formData.includeDetails.includes('members')) {
    headers.push('成员列表')
  }

  // 构建 CSV 行
  const rows = data.map(group => {
    const row = formData.fields.map(field => {
      let value = group[field as keyof PermissionGroup]
      
      // 处理特殊字段
      if (field === 'cloud_platforms' && Array.isArray(value)) {
        value = value.join(', ')
      } else if (typeof value === 'object') {
        value = JSON.stringify(value)
      }
      
      // 处理包含逗号或引号的值
      const strValue = String(value || '')
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        return `"${strValue.replace(/"/g, '""')}"`
      }
      return strValue
    })

    // 添加权限策略
    if (formData.includeDetails.includes('policies')) {
      const policies = group.policies || []
      const policiesStr = policies.map((p: any) => 
        `${p.policy_name}(${p.policy_type})`
      ).join('; ')
      row.push(`"${policiesStr}"`)
    }

    // 添加成员列表
    if (formData.includeDetails.includes('members')) {
      const members = group.members || []
      const membersStr = members.map((m: CloudUser) => 
        `${m.username}${m.display_name ? `(${m.display_name})` : ''}`
      ).join('; ')
      row.push(`"${membersStr}"`)
    }

    return row
  })

  // 组合 CSV 内容
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  // 添加 BOM 以支持中文
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadFile(blob, `用户组导出_${getTimestamp()}.csv`)
}

// 导出为 JSON
const exportAsJSON = (data: any[]) => {
  const exportData = data.map(group => {
    const item: any = {}
    formData.fields.forEach(field => {
      item[field] = group[field as keyof PermissionGroup]
    })

    // 添加权限策略
    if (formData.includeDetails.includes('policies')) {
      item.policies = group.policies || []
    }

    // 添加成员列表
    if (formData.includeDetails.includes('members')) {
      item.members = group.members || []
    }

    return item
  })

  const jsonContent = JSON.stringify(exportData, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
  downloadFile(blob, `用户组导出_${getTimestamp()}.json`)
}

// 导出为 Excel (简化版，实际使用 CSV 格式)
const exportAsExcel = (data: any[]) => {
  exportAsCSV(data)
  ElMessage.info('Excel 格式导出为 CSV 格式，可用 Excel 打开')
}

// 下载文件
const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// 获取时间戳
const getTimestamp = () => {
  const now = new Date()
  return now.toISOString().replace(/[:.]/g, '-').slice(0, -5)
}
</script>

<style scoped lang="scss">
:deep(.el-checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
