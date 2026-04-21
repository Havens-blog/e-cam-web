<template>
  <div class="tag-rule-panel">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
      <div style="font-size: 15px; color: var(--text-secondary)">定义自动打标规则，根据资源属性自动匹配并打标</div>
      <el-button type="primary" @click="openCreateDialog">+ 创建规则</el-button>
    </div>
    <div v-loading="loading">
      <div v-for="rule in rules" :key="rule.id" class="rule-card">
        <div class="rule-header">
          <div style="display: flex; align-items: center; gap: 10px">
            <span class="rule-name">{{ rule.name }}</span>
            <el-tag size="small" :type="rule.status === 'enabled' ? 'success' : 'info'">{{ rule.status === 'enabled' ? '已启用' : '已禁用' }}</el-tag>
            <el-tag size="small" type="warning">优先级 {{ rule.priority }}</el-tag>
            <el-tag size="small">{{ rule.logic === 'or' ? '任一匹配(OR)' : '全部匹配(AND)' }}</el-tag>
          </div>
          <div style="display: flex; gap: 8px">
            <el-button type="primary" link size="small" @click="handlePreview(rule)">预览</el-button>
            <el-button type="success" link size="small" @click="handleExecute(rule)">执行</el-button>
            <el-button type="primary" link size="small" @click="openEditDialog(rule)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(rule)">删除</el-button>
          </div>
        </div>
        <div v-if="rule.description" class="rule-desc">{{ rule.description }}</div>
        <div style="margin-bottom: 8px">
          <span style="font-size: 13px; color: var(--text-secondary)">匹配条件：</span>
          <el-tag v-for="(c, idx) in (rule.conditions || []).filter((x: any) => x != null)" :key="idx" size="small" type="primary" style="margin-right: 4px; margin-bottom: 2px">{{ fieldLabel(c.field) }} {{ operatorLabel(c.operator) }} "{{ c.value }}"</el-tag>
        </div>
        <div>
          <span style="font-size: 13px; color: var(--text-secondary)">打标内容：</span>
          <el-tag v-for="(val, key) in rule.tags || {}" :key="key" size="small" type="success" style="margin-right: 4px">{{ key }}={{ val }}</el-tag>
        </div>
        <div v-if="previewResults[rule.id] !== undefined" style="margin-top: 8px; font-size: 13px; color: #409eff">预览：匹配 <strong>{{ previewResults[rule.id] }}</strong> 个资源</div>
      </div>
      <el-empty v-if="rules.length === 0 && !loading" description="暂无自动打标规则" />
    </div>
    <el-dialog v-model="showDialog" :title="editingRule ? '编辑自动打标规则' : '创建自动打标规则'" width="650px" :destroy-on-close="true">
      <el-form label-position="top">
        <el-form-item label="规则名称" required><el-input v-model="form.name" placeholder="如：生产环境资源打标" /></el-form-item>
        <el-form-item label="规则描述"><el-input v-model="form.description" placeholder="描述规则的用途" /></el-form-item>
        <el-form-item label="条件逻辑"><el-radio-group v-model="form.logic"><el-radio value="and">全部匹配 (AND)</el-radio><el-radio value="or">任一匹配 (OR)</el-radio></el-radio-group></el-form-item>
        <el-form-item label="匹配条件" required>
          <div v-for="(cond, idx) in form.conditions" :key="idx" class="condition-row">
            <el-select v-model="cond.field" placeholder="字段" style="width: 130px"><el-option label="资源名称" value="asset_name" /><el-option label="资源ID" value="asset_id" /><el-option label="资源类型" value="model_uid" /><el-option label="云厂商" value="provider" /><el-option label="区域" value="region" /><el-option label="云账号" value="account_name" /></el-select>
            <el-select v-model="cond.operator" placeholder="操作" style="width: 100px"><el-option label="包含" value="contains" /><el-option label="等于" value="equals" /><el-option label="前缀" value="prefix" /><el-option label="后缀" value="suffix" /><el-option label="正则" value="regex" /></el-select>
            <el-input v-model="cond.value" placeholder="匹配值" style="flex: 1" />
            <el-button circle size="small" @click="removeCondition(idx)" :disabled="form.conditions.length <= 1">x</el-button>
          </div>
          <el-button type="primary" link size="small" style="margin-top: 4px" @click="addCondition">+ 添加条件</el-button>
        </el-form-item>
        <el-form-item label="打标内容" required>
          <div v-for="(pair, idx) in form.tagPairs" :key="idx" class="condition-row">
            <el-input v-model="pair.key" placeholder="标签键" style="flex: 1" />
            <el-input v-model="pair.value" placeholder="标签值" style="flex: 1" />
            <el-button circle size="small" @click="removeTagPair(idx)" :disabled="form.tagPairs.length <= 1">x</el-button>
          </div>
          <el-button type="primary" link size="small" style="margin-top: 4px" @click="addTagPair">+ 添加标签</el-button>
        </el-form-item>
        <el-form-item label="优先级"><el-input-number v-model="form.priority" :min="1" :max="100" /><span style="margin-left: 8px; font-size: 12px; color: var(--text-tertiary)">数字越小优先级越高</span></el-form-item>
      </el-form>
      <template #footer><el-button @click="showDialog = false">取消</el-button><el-button type="primary" :loading="submitting" @click="handleSubmit">{{ editingRule ? '保存' : '创建规则' }}</el-button></template>
    </el-dialog>
    <el-dialog v-model="showResultDialog" title="执行结果" width="500px">
      <div v-for="r in executeResults" :key="r.rule_id" style="margin-bottom: 12px">
        <div style="font-weight: 600; margin-bottom: 4px">{{ r.rule_name }}</div>
        <div style="font-size: 13px; color: var(--text-secondary)">匹配 {{ r.match_count }} 个，成功 <span style="color: #67c23a">{{ r.success_count }}</span>，失败 <span style="color: #f56c6c">{{ r.failed_count }}</span></div>
      </div>
      <el-empty v-if="executeResults.length === 0" description="无执行结果" />
    </el-dialog>

    <!-- 执行确认对话框 -->
    <el-dialog
      v-model="confirmDialog.visible"
      :show-close="false"
      width="420px"
      class="confirm-dialog"
      align-center
      :close-on-click-modal="false"
    >
      <div class="confirm-content">
        <div class="confirm-icon" :class="confirmDialog.type">
          <el-icon :size="28">
            <WarningFilled v-if="confirmDialog.type === 'warning'" />
            <DeleteFilled v-else-if="confirmDialog.type === 'danger'" />
          </el-icon>
        </div>
        <div class="confirm-text">
          <div class="confirm-title">{{ confirmDialog.title }}</div>
          <div class="confirm-desc">{{ confirmDialog.message }}</div>
        </div>
      </div>
      <template #footer>
        <div class="confirm-footer">
          <el-button @click="confirmDialog.visible = false">取消</el-button>
          <el-button
            :type="confirmDialog.type === 'danger' ? 'danger' : 'primary'"
            :loading="confirmDialog.loading"
            @click="confirmDialog.onConfirm"
          >
            {{ confirmDialog.confirmText }}
          </el-button>
        </div>
      </template>
    </el-dialog>
    <!-- Preview Drawer -->
    <el-drawer v-model="showPreviewDrawer" title="规则预览" size="700px" :destroy-on-close="true">
      <template #header>
        <div>
          <h3 style="font-size: 18px; font-weight: 600; margin: 0">规则预览：{{ previewRuleName }}</h3>
          <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px">共匹配 <strong style="color: #409eff">{{ previewTotal }}</strong> 个资源（显示前 100 条）</div>
        </div>
      </template>
      <el-table :data="previewResourceList" v-loading="previewLoading" style="width: 100%">
        <el-table-column prop="asset_id" label="资源ID" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span style="font-family: monospace; font-size: 13px">{{ row?.asset_id }}</span></template>
        </el-table-column>
        <el-table-column prop="asset_name" label="资源名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="resource_type" label="类型" width="100">
          <template #default="{ row }"><el-tag size="small">{{ row?.resource_type?.toUpperCase() }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="provider" label="云厂商" width="90">
          <template #default="{ row }"><el-tag size="small" type="warning">{{ row?.provider }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="region" label="区域" width="120" show-overflow-tooltip />
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { createRuleApi, deleteRuleApi, executeRulesApi, listRulesApi, previewRulesApi, updateRuleApi } from '@/api/tag'
import type { RuleCondition, RuleExecuteResult, TagRule } from '@/api/types/tag'
import { DeleteFilled, WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

const loading = ref(false)
const rules = ref<TagRule[]>([])
const showDialog = ref(false)
const editingRule = ref<TagRule | null>(null)
const submitting = ref(false)
const previewResults = reactive<Record<number, number>>({})
const showResultDialog = ref(false)
const executeResults = ref<RuleExecuteResult[]>([])
const showPreviewDrawer = ref(false)
const previewLoading = ref(false)
const previewRuleName = ref('')
const previewTotal = ref(0)
const previewResourceList = ref<import('@/api/types/tag').PreviewResource[]>([])
const form = reactive({
  name: '',
  description: '',
  logic: 'and' as 'and' | 'or',
  conditions: [{ field: 'asset_name', operator: 'contains', value: '' }] as RuleCondition[],
  tagPairs: [{ key: '', value: '' }],
  priority: 10,
})
const loadRules = async () => {
  loading.value = true
  try {
    const res = await listRulesApi({ offset: 0, limit: 100 })
    rules.value = (res.data?.items || []).filter(r => r != null)
  } catch { rules.value = [] } finally { loading.value = false }
}
const openCreateDialog = () => {
  editingRule.value = null
  Object.assign(form, { name: '', description: '', logic: 'and', conditions: [{ field: 'asset_name', operator: 'contains', value: '' }], tagPairs: [{ key: '', value: '' }], priority: 10 })
  showDialog.value = true
}
const openEditDialog = (rule: TagRule) => {
  editingRule.value = rule
  const tp = Object.entries(rule.tags || {}).map(([k, v]) => ({ key: k, value: v }))
  Object.assign(form, { name: rule.name, description: rule.description, logic: rule.logic || 'and', conditions: [...(rule.conditions || [])], tagPairs: tp.length > 0 ? tp : [{ key: '', value: '' }], priority: rule.priority || 10 })
  showDialog.value = true
}
const addCondition = () => { form.conditions.push({ field: 'asset_name', operator: 'contains', value: '' }) }
const removeCondition = (idx: number) => { if (form.conditions.length > 1) form.conditions.splice(idx, 1) }
const addTagPair = () => { form.tagPairs.push({ key: '', value: '' }) }
const removeTagPair = (idx: number) => { if (form.tagPairs.length > 1) form.tagPairs.splice(idx, 1) }
const handleSubmit = async () => {
  if (!form.name.trim()) { ElMessage.warning('请输入规则名称'); return }
  const vc = form.conditions.filter(c => c.field && c.operator && c.value.trim())
  if (vc.length === 0) { ElMessage.warning('请至少添加一个有效条件'); return }
  const vt = form.tagPairs.filter(t => t.key.trim() && t.value.trim())
  if (vt.length === 0) { ElMessage.warning('请至少填写一组标签'); return }
  const tags: Record<string, string> = {}
  vt.forEach(t => { tags[t.key.trim()] = t.value.trim() })
  submitting.value = true
  try {
    if (editingRule.value) {
      await updateRuleApi(editingRule.value.id, { name: form.name, description: form.description, logic: form.logic, conditions: vc, tags, priority: form.priority })
      ElMessage.success('规则更新成功')
    } else {
      await createRuleApi({ name: form.name, description: form.description, logic: form.logic, conditions: vc, tags, priority: form.priority })
      ElMessage.success('规则创建成功')
    }
    showDialog.value = false; loadRules()
  } catch (err: any) { ElMessage.error(err?.message || '操作失败') } finally { submitting.value = false }
}
const handleDelete = async (rule: TagRule) => {
  confirmDialog.title = '删除规则'
  confirmDialog.message = `确定删除规则「${rule.name}」？删除后不可恢复。`
  confirmDialog.type = 'danger'
  confirmDialog.confirmText = '确定删除'
  confirmDialog.loading = false
  confirmDialog.onConfirm = async () => {
    confirmDialog.loading = true
    try {
      await deleteRuleApi(rule.id)
      ElMessage.success('删除成功')
      confirmDialog.visible = false
      loadRules()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '删除失败'
      ElMessage.error(msg)
    } finally {
      confirmDialog.loading = false
    }
  }
  confirmDialog.visible = true
}
const handlePreview = async (rule: TagRule) => {
  previewRuleName.value = rule.name
  previewTotal.value = 0
  previewResourceList.value = []
  showPreviewDrawer.value = true
  previewLoading.value = true
  try {
    const res = await previewRulesApi([rule.id])
    const items = (res.data?.items || []).filter(r => r != null)
    if (items.length > 0 && items[0]) {
      previewTotal.value = items[0].match_count
      previewResourceList.value = (items[0].resources || []).filter(r => r != null)
    }
  } catch (err: any) { ElMessage.error(err?.message || '预览失败') }
  finally { previewLoading.value = false }
}
// 确认对话框状态
const confirmDialog = reactive({
  visible: false,
  title: '',
  message: '',
  type: 'warning' as 'warning' | 'danger',
  confirmText: '确定',
  loading: false,
  onConfirm: () => {},
})

const handleExecute = async (rule: TagRule) => {
  confirmDialog.title = '执行规则'
  confirmDialog.message = `确定执行规则「${rule.name}」？将自动为匹配资源打标。`
  confirmDialog.type = 'warning'
  confirmDialog.confirmText = '确定执行'
  confirmDialog.loading = false
  confirmDialog.onConfirm = async () => {
    confirmDialog.loading = true
    try {
      const res = await executeRulesApi([rule.id])
      executeResults.value = (res.data?.items || []).filter(r => r != null)
      confirmDialog.visible = false
      showResultDialog.value = true
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '执行失败'
      ElMessage.error(msg)
    } finally {
      confirmDialog.loading = false
    }
  }
  confirmDialog.visible = true
}
const fieldLabel = (f: string) => ({ asset_name: '资源名称', asset_id: '资源ID', model_uid: '资源类型', provider: '云厂商', region: '区域', account_name: '云账号' }[f] || f)
const operatorLabel = (o: string) => ({ contains: '包含', equals: '等于', prefix: '前缀', suffix: '后缀', regex: '正则' }[o] || o)
onMounted(() => { loadRules() })
defineExpose({ loadRules })
</script>

<style scoped lang="scss">
.rule-card { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 10px; padding: 16px 20px; margin-bottom: 12px; &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); } }
.rule-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.rule-name { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.rule-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.condition-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; width: 100%; }

.confirm-content {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 8px 0;
}

.confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.warning {
    background: rgba(230, 162, 60, 0.12);
    color: #e6a23c;
  }

  &.danger {
    background: rgba(245, 108, 108, 0.12);
    color: #f56c6c;
  }
}

.confirm-text {
  flex: 1;
  min-width: 0;
}

.confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.confirm-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.confirm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>

<style lang="scss">
.confirm-dialog {
  .el-dialog {
    border-radius: 16px;
    overflow: hidden;
  }

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 24px 24px 0;
  }

  .el-dialog__footer {
    padding: 16px 24px 24px;
  }
}
</style>
