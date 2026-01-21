<template>
  <el-dialog
    v-model="dialogVisible"
    title="导出审计日志"
    width="600px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="导出格式" prop="format">
        <el-radio-group v-model="formData.format">
          <el-radio value="csv">CSV</el-radio>
          <el-radio value="json">JSON</el-radio>
          <el-radio value="excel">Excel</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="时间范围" prop="dateRange">
        <el-date-picker
          v-model="formData.dateRange"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="筛选条件">
        <el-checkbox-group v-model="formData.includeFilters">
          <el-checkbox value="operator">操作人</el-checkbox>
          <el-checkbox value="operation_type">操作类型</el-checkbox>
          <el-checkbox value="target_type">目标类型</el-checkbox>
          <el-checkbox value="provider">云平台</el-checkbox>
          <el-checkbox value="tenant_id">租户</el-checkbox>
        </el-checkbox-group>
        <div class="form-tip">选择要应用的筛选条件</div>
      </el-form-item>

      <el-form-item label="包含字段">
        <el-checkbox-group v-model="formData.fields">
          <el-checkbox value="operation_time">操作时间</el-checkbox>
          <el-checkbox value="operator">操作人</el-checkbox>
          <el-checkbox value="operation_type">操作类型</el-checkbox>
          <el-checkbox value="target_type">目标类型</el-checkbox>
          <el-checkbox value="target_name">目标对象</el-checkbox>
          <el-checkbox value="provider">云平台</el-checkbox>
          <el-checkbox value="result">操作结果</el-checkbox>
          <el-checkbox value="ip_address">IP 地址</el-checkbox>
          <el-checkbox value="description">操作描述</el-checkbox>
        </el-checkbox-group>
        <div class="form-tip">选择要导出的字段</div>
      </el-form-item>

      <el-form-item label="最大记录数" prop="maxRecords">
        <el-input-number
          v-model="formData.maxRecords"
          :min="1"
          :max="10000"
          :step="100"
          style="width: 200px"
        />
        <div class="form-tip">最多导出 10000 条记录</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="exporting" @click="handleExport">
        {{ exporting ? '导出中...' : '导出' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { exportAuditLogsApi } from '@/api/iam'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'

interface Props {
  visible: boolean
  filters: Record<string, any>
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()
const exporting = ref(false)

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 表单数据
const formData = reactive({
  format: 'csv' as 'csv' | 'json' | 'excel',
  dateRange: null as [Date, Date] | null,
  includeFilters: ['operator', 'operation_type', 'target_type', 'provider', 'tenant_id'],
  fields: [
    'operation_time',
    'operator',
    'operation_type',
    'target_type',
    'target_name',
    'provider',
    'result',
    'ip_address'
  ],
  maxRecords: 1000
})

// 表单验证规则
const rules: FormRules = {
  format: [
    { required: true, message: '请选择导出格式', trigger: 'change' }
  ],
  dateRange: [
    { required: true, message: '请选择时间范围', trigger: 'change' }
  ],
  maxRecords: [
    { required: true, message: '请输入最大记录数', trigger: 'blur' }
  ]
}

// 导出
const handleExport = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  exporting.value = true

  try {
    // 构建导出参数
    const exportParams: Record<string, any> = {
      format: formData.format,
      start_time: formData.dateRange?.[0].toISOString(),
      end_time: formData.dateRange?.[1].toISOString(),
      fields: formData.fields,
      max_records: formData.maxRecords
    }

    // 应用筛选条件
    formData.includeFilters.forEach(filter => {
      if (props.filters[filter]) {
        exportParams[filter] = props.filters[filter]
      }
    })

    // 调用导出 API
    const response = await exportAuditLogsApi(exportParams)

    // 下载文件
    const blob = new Blob([response.data], {
      type: formData.format === 'csv' ? 'text/csv' : 'application/json'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit_logs_${Date.now()}.${formData.format}`
    link.click()
    window.URL.revokeObjectURL(url)

    ElMessage.success('导出成功')
    emit('success')
    handleClose()
  } catch (error: any) {
    console.error('导出失败:', error)
    ElMessage.error(error.message || '导出失败')
  } finally {
    exporting.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  formRef.value?.resetFields()
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.form-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
