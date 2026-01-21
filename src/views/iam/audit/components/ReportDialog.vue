<template>
  <el-dialog
    v-model="dialogVisible"
    title="生成审计报告"
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
      <el-form-item label="报告名称" prop="name">
        <el-input
          v-model="formData.name"
          placeholder="请输入报告名称"
        />
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

      <el-form-item label="租户" prop="tenantIds">
        <el-select
          v-model="formData.tenantIds"
          multiple
          filterable
          placeholder="请选择租户（不选则包含所有租户）"
          style="width: 100%"
        >
          <el-option
            v-for="tenant in tenants"
            :key="tenant.id"
            :label="tenant.display_name || tenant.name"
            :value="tenant.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="报告类型" prop="reportType">
        <el-radio-group v-model="formData.reportType">
          <el-radio value="summary">汇总报告</el-radio>
          <el-radio value="detailed">详细报告</el-radio>
        </el-radio-group>
        <div class="form-tip">
          汇总报告：包含统计数据和图表<br />
          详细报告：包含所有日志记录详情
        </div>
      </el-form-item>

      <el-form-item label="报告格式" prop="format">
        <el-radio-group v-model="formData.format">
          <el-radio value="pdf">PDF</el-radio>
          <el-radio value="html">HTML</el-radio>
          <el-radio value="excel">Excel</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="包含内容">
        <el-checkbox-group v-model="formData.sections">
          <el-checkbox value="overview">概览统计</el-checkbox>
          <el-checkbox value="operations">操作统计</el-checkbox>
          <el-checkbox value="users">用户活动</el-checkbox>
          <el-checkbox value="errors">错误分析</el-checkbox>
          <el-checkbox value="trends">趋势分析</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>

    <!-- 生成进度 -->
    <div v-if="generating" class="progress-section">
      <el-progress
        :percentage="progress"
        :status="progressStatus"
      />
      <div class="progress-text">
        正在生成报告... {{ progressText }}
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose" :disabled="generating">取消</el-button>
      <el-button
        type="primary"
        :loading="generating"
        :disabled="generating"
        @click="handleGenerate"
      >
        {{ generating ? '生成中...' : '生成报告' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { generateAuditReportApi, listTenantsApi } from '@/api/iam'
import type { Tenant } from '@/api/types/iam'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const formRef = ref<FormInstance>()
const generating = ref(false)
const progress = ref(0)
const progressText = ref('')
const tenants = ref<Tenant[]>([])

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const progressStatus = computed(() => {
  if (progress.value === 100) return 'success'
  return undefined
})

// 表单数据
const formData = reactive({
  name: `审计报告_${new Date().toLocaleDateString()}`,
  dateRange: null as [Date, Date] | null,
  tenantIds: [] as string[],
  reportType: 'summary' as 'summary' | 'detailed',
  format: 'pdf' as 'pdf' | 'html' | 'excel',
  sections: ['overview', 'operations', 'users', 'errors', 'trends']
})

// 表单验证规则
const rules: FormRules = {
  name: [
    { required: true, message: '请输入报告名称', trigger: 'blur' }
  ],
  dateRange: [
    { required: true, message: '请选择时间范围', trigger: 'change' }
  ],
  reportType: [
    { required: true, message: '请选择报告类型', trigger: 'change' }
  ],
  format: [
    { required: true, message: '请选择报告格式', trigger: 'change' }
  ]
}

// 加载租户列表
const loadTenants = async () => {
  try {
    const res = await listTenantsApi({ size: 100 })
    tenants.value = res.data.tenants || []
  } catch (error) {
    console.error('加载租户列表失败:', error)
  }
}

// 生成报告
const handleGenerate = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  generating.value = true
  progress.value = 0
  progressText.value = '准备生成报告...'

  try {
    // 构建报告参数
    const reportParams = {
      name: formData.name,
      start_time: formData.dateRange?.[0].toISOString(),
      end_time: formData.dateRange?.[1].toISOString(),
      tenant_ids: formData.tenantIds.length > 0 ? formData.tenantIds : undefined,
      report_type: formData.reportType,
      format: formData.format,
      sections: formData.sections
    }

    // 模拟进度更新
    const progressSteps = [
      { value: 20, text: '收集数据...' },
      { value: 40, text: '分析数据...' },
      { value: 60, text: '生成图表...' },
      { value: 80, text: '生成报告...' },
      { value: 100, text: '完成' }
    ]

    for (const step of progressSteps) {
      progress.value = step.value
      progressText.value = step.text
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // 调用生成报告 API
    const response = await generateAuditReportApi(reportParams)

    // 下载报告文件
    const blob = new Blob([response.data], {
      type: formData.format === 'pdf' ? 'application/pdf' : 
            formData.format === 'html' ? 'text/html' : 
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${formData.name}.${formData.format}`
    link.click()
    window.URL.revokeObjectURL(url)

    ElMessage.success('报告生成成功')
    emit('success')
    
    // 延迟关闭对话框
    setTimeout(() => {
      handleClose()
    }, 1000)
  } catch (error: any) {
    console.error('生成报告失败:', error)
    ElMessage.error(error.message || '生成报告失败')
    progress.value = 0
    progressText.value = ''
  } finally {
    generating.value = false
  }
}

// 关闭对话框
const handleClose = () => {
  if (generating.value) {
    ElMessage.warning('正在生成报告,请稍候...')
    return
  }
  
  formRef.value?.resetFields()
  progress.value = 0
  progressText.value = ''
  emit('update:visible', false)
}

// 初始化
onMounted(() => {
  loadTenants()
})
</script>

<style scoped lang="scss">
.form-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.progress-section {
  margin-top: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;

  .progress-text {
    margin-top: 12px;
    text-align: center;
    font-size: 14px;
    color: #606266;
  }
}
</style>
