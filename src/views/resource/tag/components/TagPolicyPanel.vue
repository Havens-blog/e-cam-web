<template>
  <div class="tag-policy-panel">
    <!-- Policy List Tab -->
    <div v-if="activeView === 'policies'">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
        <div style="font-size: 15px; color: var(--text-secondary)">定义标签策略来规范标签使用，推动标签治理一致性</div>
        <el-button type="primary" @click="openCreateDialog">＋ 创建策略</el-button>
      </div>

      <div v-loading="loading">
        <div v-for="policy in policies.filter(p => p != null)" :key="policy.id" class="policy-card">
          <div class="policy-header">
            <div style="display: flex; align-items: center; gap: 10px">
              <span class="policy-name">{{ policy.name }}</span>
              <el-tag size="small" :type="policy.status === 'enabled' ? 'success' : 'info'">
                {{ policy.status === 'enabled' ? '已启用' : '已禁用' }}
              </el-tag>
            </div>
            <div style="display: flex; gap: 8px">
              <el-button type="primary" link size="small" @click="openEditDialog(policy)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(policy)">删除</el-button>
            </div>
          </div>
          <div class="policy-desc">{{ policy.description }}</div>
          <div style="display: flex; gap: 24px; font-size: 13px; color: var(--text-secondary); margin-bottom: 10px">
            <span>必填标签键：<strong style="color: var(--text-primary)">{{ (policy.required_keys || []).join(', ') }}</strong></span>
            <span>适用资源：<strong style="color: var(--text-primary)">{{ formatResourceTypes(policy.resource_types) }}</strong></span>
          </div>
          <div v-if="policy.key_value_constraints && Object.keys(policy.key_value_constraints).length > 0">
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 6px">标签值约束：</div>
            <div class="policy-tags">
              <el-tag
                v-for="(values, key) in policy.key_value_constraints"
                :key="key"
                size="small"
                type="primary"
              >{{ key }}: {{ (values || []).join(', ') }}</el-tag>
            </div>
          </div>
        </div>
        <el-empty v-if="policies.length === 0 && !loading" description="暂无标签策略" />
      </div>
    </div>

    <!-- Compliance Tab -->
    <div v-if="activeView === 'compliance'">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
        <div style="display: flex; gap: 16px; align-items: center">
          <div class="compliance-stat-card pass">
            <span style="font-size: 24px">✅</span>
            <div>
              <div style="font-size: 20px; font-weight: 700; color: #67c23a">{{ complianceData.compliant_count }}</div>
              <div style="font-size: 12px; color: #67c23a">合规资源</div>
            </div>
          </div>
          <div class="compliance-stat-card fail">
            <span style="font-size: 24px">⚠️</span>
            <div>
              <div style="font-size: 20px; font-weight: 700; color: #f56c6c">{{ complianceData.non_compliant_count }}</div>
              <div style="font-size: 12px; color: #f56c6c">不合规资源</div>
            </div>
          </div>
        </div>
        <div style="display: flex; gap: 10px">
          <el-select v-model="complianceFilter.policy_id" placeholder="全部策略" clearable style="width: 150px" @change="handleComplianceFilterChange">
            <el-option v-for="p in policies.filter(i => i != null)" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
          <el-select v-model="complianceFilter.resource_type" placeholder="全部资源类型" clearable style="width: 130px" @change="handleComplianceFilterChange">
            <el-option label="ECS" value="ecs" />
            <el-option label="RDS" value="rds" />
            <el-option label="Redis" value="redis" />
            <el-option label="CDN" value="cdn" />
            <el-option label="WAF" value="waf" />
            <el-option label="VPC" value="vpc" />
            <el-option label="NAS" value="nas" />
          </el-select>
          <el-button @click="loadCompliance">🔄 重新检查</el-button>
          <el-button @click="showExportDialog = true">📥 导出</el-button>
        </div>
      </div>

      <!-- Batch remediation bar -->
      <div v-if="selectedCompliance.length > 0" class="batch-bar">
        <div style="display: flex; align-items: center; gap: 6px; color: #409eff; font-size: 13px">
          ✅ 已选 <strong>{{ selectedCompliance.length }}</strong> 个不合规资源
        </div>
        <div style="display: flex; gap: 8px">
          <el-button size="small" type="primary" @click="handleBatchRemediate">🏷 批量修复标签</el-button>
          <el-button size="small" @click="complianceTableRef?.clearSelection()">取消选择</el-button>
        </div>
      </div>

      <el-table
        ref="complianceTableRef"
        :data="complianceResults"
        v-loading="complianceLoading"
        style="width: 100%"
        row-key="asset_id"
        @selection-change="handleComplianceSelection"
      >
        <el-table-column type="selection" width="40" />
        <el-table-column prop="asset_id" label="资源ID" min-width="130">
          <template #default="{ row }">
            <span style="font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; color: var(--text-secondary)">{{ row?.asset_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="asset_name" label="资源名称" min-width="120" />
        <el-table-column prop="resource_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row?.resource_type?.toUpperCase() }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="provider" label="云厂商" width="80">
          <template #default="{ row }">
            <el-tag size="small" type="warning">{{ getProviderLabel(row?.provider) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="违规项" min-width="200">
          <template #default="{ row }">
            <template v-if="row?.violations && row.violations.length > 0">
              <el-tag
                v-for="(v, idx) in row.violations.filter((i: any) => i != null)"
                :key="idx"
                size="small"
                type="warning"
                style="margin-right: 4px; margin-bottom: 2px"
              >
                {{ formatViolation(v) }}
              </el-tag>
            </template>
            <span v-else style="color: var(--text-tertiary)">—</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <span
              class="compliance-badge"
              :class="row?.violations && row.violations.length > 0 ? 'fail' : 'pass'"
            >
              {{ row?.violations && row.violations.length > 0 ? '⚠ 不合规' : '✓ 合规' }}
            </span>
          </template>
        </el-table-column>
      </el-table>

      <!-- Compliance Pagination -->
      <div class="compliance-pagination">
        <div style="font-size: 13px; color: var(--text-secondary)">
          本页 {{ complianceResults.length }} 条 / 共 {{ complianceData.total }} 条不合规
        </div>
        <el-pagination
          v-model:current-page="compliancePage"
          :page-size="compliancePageSize"
          :total="complianceData.total"
          :page-sizes="[50, 100, 200]"
          layout="sizes, prev, pager, next"
          @current-change="loadCompliance"
          @size-change="handleCompliancePageSizeChange"
        />
      </div>
    </div>

    <!-- Create/Edit Policy Dialog -->
    <el-dialog v-model="showPolicyDialog" :title="editingPolicy ? '📋 编辑标签策略' : '📋 创建标签策略'" width="600px" :destroy-on-close="true">
      <el-form label-position="top">
        <el-form-item label="策略名称" required>
          <el-input v-model="policyForm.name" placeholder="如：基础标签规范" />
        </el-form-item>
        <el-form-item label="策略描述">
          <el-input v-model="policyForm.description" placeholder="描述策略的用途和目标" />
        </el-form-item>
        <el-form-item label="必填标签键" required>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px">
            <el-tag
              v-for="key in policyForm.required_keys"
              :key="key"
              closable
              @close="policyForm.required_keys = policyForm.required_keys.filter(k => k !== key)"
            >{{ key }}</el-tag>
          </div>
          <div style="display: flex; gap: 8px">
            <el-input v-model="newRequiredKey" placeholder="输入标签键" style="flex: 1" @keyup.enter="addRequiredKey" />
            <el-button size="small" @click="addRequiredKey">添加</el-button>
          </div>
        </el-form-item>
        <el-form-item label="标签值约束">
          <div v-for="(values, key) in policyForm.key_value_constraints" :key="key" class="constraint-block">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
              <span style="font-size: 13px; font-weight: 500">{{ key }}</span>
              <el-button type="danger" link size="small" @click="removeConstraint(key as string)">删除</el-button>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px">
              <el-tag
                v-for="val in (values || [])"
                :key="val"
                closable
                type="success"
                @close="removeConstraintValue(key as string, val)"
              >{{ val }}</el-tag>
              <el-input
                v-model="constraintValueInputs[key as string]"
                placeholder="添加值"
                size="small"
                style="width: 100px"
                @keyup.enter="addConstraintValue(key as string)"
              />
            </div>
          </div>
          <el-button type="primary" link size="small" @click="showAddConstraint = true" style="margin-top: 4px">
            ＋ 添加值约束
          </el-button>
          <div v-if="showAddConstraint" style="display: flex; gap: 8px; margin-top: 8px">
            <el-input v-model="newConstraintKey" placeholder="标签键" style="width: 120px" />
            <el-button size="small" @click="addConstraint">确定</el-button>
            <el-button size="small" @click="showAddConstraint = false">取消</el-button>
          </div>
        </el-form-item>
        <el-form-item label="适用资源类型">
          <el-checkbox-group v-model="policyForm.resource_types">
            <el-checkbox value="ecs" label="ECS" />
            <el-checkbox value="rds" label="RDS" />
            <el-checkbox value="redis" label="Redis" />
            <el-checkbox value="mongodb" label="MongoDB" />
            <el-checkbox value="vpc" label="VPC" />
            <el-checkbox value="oss" label="OSS" />
            <el-checkbox value="nas" label="NAS" />
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPolicyDialog = false">取消</el-button>
        <el-button type="primary" :loading="policySubmitting" @click="handlePolicySubmit">
          {{ editingPolicy ? '保存' : '创建策略' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Export Dialog -->
    <ComplianceExportDialog
      v-model:visible="showExportDialog"
      :current-page-data="complianceResults"
      :selected-data="selectedCompliance"
      :total-count="complianceData.total"
    />
  </div>
</template>

<script setup lang="ts">
import {
  checkComplianceApi,
  createPolicyApi,
  deletePolicyApi,
  listPoliciesApi,
  updatePolicyApi
} from '@/api/tag'
import type { ComplianceResult, TagPolicy, Violation } from '@/api/types/tag'
import { getProviderLabel } from '@/utils/constants'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref, watch } from 'vue'
import ComplianceExportDialog from './ComplianceExportDialog.vue'

const props = defineProps<{
  activeView: 'policies' | 'compliance'
}>()

const emit = defineEmits<{
  (e: 'remediate', resources: ComplianceResult[], policy: TagPolicy | null): void
}>()

const loading = ref(false)
const policies = ref<TagPolicy[]>([])
const showPolicyDialog = ref(false)
const editingPolicy = ref<TagPolicy | null>(null)
const policySubmitting = ref(false)
const newRequiredKey = ref('')
const newConstraintKey = ref('')
const showAddConstraint = ref(false)
const showExportDialog = ref(false)
const constraintValueInputs = reactive<Record<string, string>>({})

const policyForm = reactive({
  name: '',
  description: '',
  required_keys: [] as string[],
  key_value_constraints: {} as Record<string, string[]>,
  resource_types: [] as string[],
})

// Compliance
const complianceLoading = ref(false)
const complianceResults = ref<ComplianceResult[]>([])
const complianceData = reactive({ compliant_count: 0, non_compliant_count: 0, total: 0 })
const complianceFilter = reactive({ policy_id: undefined as number | undefined, resource_type: '' })
const compliancePage = ref(1)
const compliancePageSize = ref(50)

const loadPolicies = async () => {
  loading.value = true
  try {
    const res = await listPoliciesApi({ offset: 0, limit: 100 })
    policies.value = res.data?.items || []
    // Auto-select first policy for compliance check
    if (policies.value.length > 0 && !complianceFilter.policy_id) {
      complianceFilter.policy_id = policies.value[0]?.id
    }
  } catch {
    policies.value = []
  } finally {
    loading.value = false
  }
}

const loadCompliance = async () => {
  if (!complianceFilter.policy_id) {
    complianceResults.value = []
    complianceData.compliant_count = 0
    complianceData.non_compliant_count = 0
    complianceData.total = 0
    return
  }
  complianceLoading.value = true
  try {
    const offset = (compliancePage.value - 1) * compliancePageSize.value
    const res = await checkComplianceApi({
      policy_id: complianceFilter.policy_id,
      resource_type: complianceFilter.resource_type || undefined,
      offset,
      limit: compliancePageSize.value,
    })
    complianceResults.value = (res.data?.items || []).filter(r => r != null)
    complianceData.compliant_count = res.data?.compliant_count || 0
    complianceData.non_compliant_count = res.data?.non_compliant_count || 0
    complianceData.total = res.data?.total || res.data?.non_compliant_count || 0
  } catch (err: any) {
    console.error('[compliance] loadCompliance error:', err?.response?.status, err?.response?.data, err?.message)
    complianceResults.value = []
  } finally {
    complianceLoading.value = false
  }
}

const openCreateDialog = () => {
  editingPolicy.value = null
  Object.assign(policyForm, { name: '', description: '', required_keys: [], key_value_constraints: {}, resource_types: [] })
  showPolicyDialog.value = true
}

const openEditDialog = (policy: TagPolicy) => {
  editingPolicy.value = policy
  Object.assign(policyForm, {
    name: policy.name,
    description: policy.description,
    required_keys: [...(policy.required_keys || [])],
    key_value_constraints: JSON.parse(JSON.stringify(policy.key_value_constraints || {})),
    resource_types: [...(policy.resource_types || [])],
  })
  showPolicyDialog.value = true
}

const addRequiredKey = () => {
  const key = newRequiredKey.value.trim()
  if (key && !policyForm.required_keys.includes(key)) {
    policyForm.required_keys.push(key)
  }
  newRequiredKey.value = ''
}

const addConstraint = () => {
  const key = newConstraintKey.value.trim()
  if (key && !(key in policyForm.key_value_constraints)) {
    policyForm.key_value_constraints[key] = []
  }
  newConstraintKey.value = ''
  showAddConstraint.value = false
}

const removeConstraint = (key: string) => {
  delete policyForm.key_value_constraints[key]
}

const addConstraintValue = (key: string) => {
  const val = constraintValueInputs[key]?.trim()
  if (val && policyForm.key_value_constraints[key] && !policyForm.key_value_constraints[key].includes(val)) {
    policyForm.key_value_constraints[key].push(val)
  }
  constraintValueInputs[key] = ''
}

const removeConstraintValue = (key: string, val: string) => {
  if (policyForm.key_value_constraints[key]) {
    policyForm.key_value_constraints[key] = policyForm.key_value_constraints[key].filter(v => v !== val)
  }
}

const handlePolicySubmit = async () => {
  if (!policyForm.name.trim()) {
    ElMessage.warning('请输入策略名称')
    return
  }
  if (policyForm.required_keys.length === 0) {
    ElMessage.warning('请至少添加一个必填标签键')
    return
  }

  policySubmitting.value = true
  try {
    if (editingPolicy.value) {
      await updatePolicyApi(editingPolicy.value.id, {
        name: policyForm.name,
        description: policyForm.description,
        required_keys: policyForm.required_keys,
        key_value_constraints: policyForm.key_value_constraints,
        resource_types: policyForm.resource_types,
      })
      ElMessage.success('策略更新成功')
    } else {
      await createPolicyApi({
        name: policyForm.name,
        description: policyForm.description,
        required_keys: policyForm.required_keys,
        key_value_constraints: policyForm.key_value_constraints,
        resource_types: policyForm.resource_types,
      })
      ElMessage.success('策略创建成功')
    }
    showPolicyDialog.value = false
    loadPolicies()
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败')
  } finally {
    policySubmitting.value = false
  }
}

const handleDelete = async (policy: TagPolicy) => {
  try {
    await ElMessageBox.confirm(`确定要删除策略"${policy.name}"吗？`, '删除策略', { type: 'warning' })
    await deletePolicyApi(policy.id)
    ElMessage.success('删除成功')
    loadPolicies()
  } catch { /* cancelled */ }
}

const formatResourceTypes = (types?: string[]) => {
  if (!types || types.length === 0) return '全部'
  return types.map(t => t.toUpperCase()).join(', ')
}

const formatViolation = (v: Violation) => {
  if (v.type === 'missing_key') return `缺少 ${v.key}`
  if (v.type === 'invalid_value') return `${v.key} 值无效: ${v.value || ''}`
  return v.key
}

// Compliance selection & pagination
const selectedCompliance = ref<ComplianceResult[]>([])
const complianceTableRef = ref()

const handleComplianceSelection = (rows: ComplianceResult[]) => {
  selectedCompliance.value = rows
}

const handleComplianceFilterChange = () => {
  compliancePage.value = 1
  loadCompliance()
}

const handleCompliancePageSizeChange = (size: number) => {
  compliancePageSize.value = size
  compliancePage.value = 1
  loadCompliance()
}

// Batch remediation - emit to parent to open batch dialog with compliance resources
const handleBatchRemediate = () => {
  if (selectedCompliance.value.length === 0) {
    ElMessage.warning('请先选择不合规资源')
    return
  }
  // Get the current policy's required keys for pre-filling
  const currentPolicy = policies.value.find(p => p?.id === complianceFilter.policy_id)
  emit('remediate', selectedCompliance.value, currentPolicy || null)
}

onMounted(async () => {
  await loadPolicies()
  // Auto-load compliance if a policy is selected
  if (complianceFilter.policy_id) {
    loadCompliance()
  }
})

// Watch for tab switch to compliance - trigger load
watch(() => props.activeView, (newView) => {
  if (newView === 'compliance' && complianceFilter.policy_id) {
    loadCompliance()
  }
})

defineExpose({ loadPolicies, loadCompliance, complianceData })
</script>

<style scoped lang="scss">
.policy-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 12px;
  transition: all 0.2s;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }
}

.policy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.policy-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.policy-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.policy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.constraint-block {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.compliance-stat-card {
  border-radius: 10px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 8px;

  &.pass {
    background: #f0f9eb;
    border: 1px solid #e1f3d8;
  }

  &.fail {
    background: #fef0f0;
    border: 1px solid #fde2e2;
  }
}

.compliance-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;

  &.pass {
    background: #f0f9eb;
    color: #67c23a;
  }

  &.fail {
    background: #fef0f0;
    color: #f56c6c;
  }
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: linear-gradient(135deg, #ecf5ff, rgba(64, 158, 255, 0.08));
  border: 1px solid #d9ecff;
  border-radius: 10px;
  margin-bottom: 12px;
}

.compliance-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  margin-top: 8px;
}
</style>
