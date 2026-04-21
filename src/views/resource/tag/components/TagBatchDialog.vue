<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="600px" :destroy-on-close="true" @close="handleClose">
    <el-form label-position="top">
      <el-form-item v-if="mode === 'normal'" label="操作类型" required>
        <el-radio-group v-model="batchType" size="large">
          <el-radio-button value="bind">批量打标</el-radio-button>
          <el-radio-button value="unbind">批量解绑</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="目标资源">
        <div class="target-summary">
          <template v-if="mode === 'remediate'">
            已选择 <strong>{{ safeComplianceResources.length }}</strong> 个不合规资源
            <template v-if="policyName">，策略：<strong>{{ policyName }}</strong></template>
          </template>
          <template v-else-if="mode === 'resourceBind'">
            已选择 <strong>{{ (bindResourceRefs || []).length }}</strong> 个资源
          </template>
          <template v-else>
            已选择 <strong>{{ selectedResources.length }}</strong> 个标签维度
            <template v-if="providerCount > 0">（跨 <strong>{{ providerCount }}</strong> 个云厂商）</template>
          </template>
        </div>
      </el-form-item>

      <!-- Remediation mode -->
      <template v-if="mode === 'remediate'">
        <el-form-item label="补充标签（填写缺失的标签键值）" required>
          <div v-for="(pair, idx) in tagPairs" :key="idx" class="tag-input-group">
            <el-input v-model="pair.key" placeholder="标签键" :disabled="pair.locked" />
            <el-input v-model="pair.value" placeholder="标签值" />
            <el-button v-if="!pair.locked" circle size="small" @click="removeTagPair(idx)" :disabled="tagPairs.length <= 1">✕</el-button>
          </div>
          <el-button type="primary" link size="small" style="margin-top: 4px" @click="addTagPair">
            ＋ 添加更多标签
          </el-button>
        </el-form-item>
        <el-form-item label="资源预览">
          <el-table :data="safeComplianceResources.slice(0, 5).filter(r => r != null)" size="small" style="width: 100%">
            <el-table-column prop="asset_id" label="资源ID" min-width="120">
              <template #default="{ row }">
                <span style="font-family: monospace; font-size: 12px">{{ row?.asset_id }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="resource_type" label="类型" width="80">
              <template #default="{ row }">
                <el-tag size="small">{{ row?.resource_type?.toUpperCase() }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="违规项" min-width="150">
              <template #default="{ row }">
                <el-tag
                  v-for="(v, i) in (row?.violations || []).filter((x: any) => x != null)"
                  :key="i"
                  size="small"
                  type="warning"
                  style="margin-right: 4px"
                >{{ v.type === 'missing_key' ? `缺少 ${v.key}` : `${v.key} 值无效` }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="safeComplianceResources.length > 5" style="font-size: 12px; color: var(--text-tertiary); margin-top: 4px">
            ... 还有 {{ safeComplianceResources.length - 5 }} 个资源
          </div>
        </el-form-item>
      </template>

      <!-- Resource bind mode (from resource drawer) -->
      <template v-else-if="mode === 'resourceBind'">
        <el-form-item label="标签键值对" required>
          <div v-for="(pair, idx) in tagPairs" :key="idx" class="tag-input-group">
            <el-input v-model="pair.key" placeholder="标签键" />
            <el-input v-model="pair.value" placeholder="标签值" />
            <el-button circle size="small" @click="removeTagPair(idx)" :disabled="tagPairs.length <= 1">✕</el-button>
          </div>
          <el-button type="primary" link size="small" style="margin-top: 4px" @click="addTagPair">
            ＋ 添加更多标签
          </el-button>
        </el-form-item>
      </template>

      <!-- Normal mode -->
      <template v-else>
        <el-form-item label="标签" required>
          <template v-if="batchType === 'bind'">
            <div v-for="(pair, idx) in tagPairs" :key="idx" class="tag-input-group">
              <el-input v-model="pair.key" placeholder="标签键" />
              <el-input v-model="pair.value" placeholder="标签值" />
              <el-button circle size="small" @click="removeTagPair(idx)" :disabled="tagPairs.length <= 1">✕</el-button>
            </div>
            <el-button type="primary" link size="small" style="margin-top: 4px" @click="addTagPair">
              ＋ 添加更多标签
            </el-button>
          </template>
          <template v-else>
            <div v-for="(_key, idx) in unbindKeys" :key="idx" class="tag-input-group">
              <el-input v-model="unbindKeys[idx]" placeholder="标签键" style="flex: 1" />
              <el-button circle size="small" @click="removeUnbindKey(idx)" :disabled="unbindKeys.length <= 1">✕</el-button>
            </div>
            <el-button type="primary" link size="small" style="margin-top: 4px" @click="unbindKeys.push('')">
              ＋ 添加更多标签键
            </el-button>
          </template>
        </el-form-item>
      </template>

      <!-- Result display -->
      <div v-if="result" class="batch-result">
        <el-alert
          :title="`操作完成：成功 ${result.success_count} 个，失败 ${result.failed_count} 个`"
          :type="result.failed_count === 0 ? 'success' : 'warning'"
          show-icon
          :closable="false"
        />
        <div v-if="result.failures && result.failures.length > 0" style="margin-top: 8px">
          <div v-for="f in result.failures.filter(x => x != null)" :key="f.resource_id" style="font-size: 13px; color: var(--el-color-danger); margin-top: 4px">
            {{ f.resource_id }}: {{ f.error }}
          </div>
        </div>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">{{ result ? '关闭' : '取消' }}</el-button>
      <el-button v-if="!result" type="primary" :loading="submitting" @click="handleSubmit">
        {{ mode === 'remediate' ? '执行修复' : '执行批量操作' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { bindTagsApi, unbindTagsApi } from '@/api/tag';
import type { BatchResult, ComplianceResult, ResourceRef, TagSummary } from '@/api/types/tag';
import { ElMessage } from 'element-plus';
import { computed, ref, watch } from 'vue';

interface TagPair { key: string; value: string; locked?: boolean }

const props = defineProps<{
  modelValue: boolean
  selectedResources: TagSummary[]
  mode?: 'normal' | 'remediate' | 'resourceBind'
  complianceResources?: ComplianceResult[]
  bindResourceRefs?: ResourceRef[]
  policyName?: string
  requiredKeys?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'success'): void
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

const batchType = ref<'bind' | 'unbind'>('bind')
const tagPairs = ref<TagPair[]>([{ key: '', value: '' }])
const unbindKeys = ref([''])
const submitting = ref(false)
const result = ref<BatchResult | null>(null)

const providerCount = computed(() => {
  const providers = new Set(props.selectedResources.map(r => r.providers).flat().filter(p => p != null))
  return providers.size
})

const safeComplianceResources = computed(() => props.complianceResources || [])

const dialogTitle = computed(() => {
  if (props.mode === 'remediate') return '🏷 批量修复标签'
  if (props.mode === 'resourceBind') return '🏷 批量打标'
  return '📦 批量标签操作'
})

// Pre-fill required keys when opening in remediate mode
watch(() => props.modelValue, (v) => {
  if (v && props.mode === 'remediate' && props.requiredKeys && props.requiredKeys.length > 0) {
    tagPairs.value = props.requiredKeys.map(k => ({ key: k, value: '', locked: true }))
  }
})

const addTagPair = () => { tagPairs.value.push({ key: '', value: '' }) }
const removeTagPair = (idx: number) => { if (tagPairs.value.length > 1) tagPairs.value.splice(idx, 1) }
const removeUnbindKey = (idx: number) => { if (unbindKeys.value.length > 1) unbindKeys.value.splice(idx, 1) }

const handleSubmit = async () => {
  if (props.mode === 'remediate') {
    await handleRemediateSubmit()
  } else if (props.mode === 'resourceBind') {
    await handleResourceBindSubmit()
  } else {
    await handleNormalSubmit()
  }
}

const handleResourceBindSubmit = async () => {
  const refs = props.bindResourceRefs || []
  if (refs.length === 0) {
    ElMessage.warning('没有选择资源')
    return
  }

  const validTags = tagPairs.value.filter(t => t.key.trim() && t.value.trim())
  if (validTags.length === 0) {
    ElMessage.warning('请至少填写一组有效的标签键值对')
    return
  }

  const tagsMap: Record<string, string> = {}
  validTags.forEach(t => { tagsMap[t.key.trim()] = t.value.trim() })

  submitting.value = true
  try {
    const res = await bindTagsApi({ resources: refs, tags: tagsMap })
    result.value = res.data
    emit('success')
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleRemediateSubmit = async () => {
  const resources = props.complianceResources || []
  if (resources.length === 0) {
    ElMessage.warning('没有选择不合规资源')
    return
  }

  const validTags = tagPairs.value.filter(t => t.key.trim() && t.value.trim())
  if (validTags.length === 0) {
    ElMessage.warning('请至少填写一组有效的标签键值对')
    return
  }

  const tagsMap: Record<string, string> = {}
  validTags.forEach(t => { tagsMap[t.key.trim()] = t.value.trim() })

  submitting.value = true
  try {
    const resourceRefs = resources.map(r => ({
      account_id: r.account_id || 0,
      region: r.region || '',
      resource_type: r.resource_type || '',
      resource_id: r.asset_id,
    }))

    const res = await bindTagsApi({ resources: resourceRefs, tags: tagsMap })
    result.value = res.data
    emit('success')
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleNormalSubmit = async () => {
  if (props.selectedResources.length === 0) {
    ElMessage.warning('请先选择资源')
    return
  }

  submitting.value = true
  try {
    const dummyResources = props.selectedResources.map(r => ({
      account_id: 0,
      region: '',
      resource_type: '',
      resource_id: `${r.key}:${r.value}`,
    }))

    if (batchType.value === 'bind') {
      const validTags = tagPairs.value.filter(t => t.key.trim() && t.value.trim())
      if (validTags.length === 0) {
        ElMessage.warning('请至少填写一组有效的标签键值对')
        submitting.value = false
        return
      }
      const tagsMap: Record<string, string> = {}
      validTags.forEach(t => { tagsMap[t.key.trim()] = t.value.trim() })
      const res = await bindTagsApi({ resources: dummyResources, tags: tagsMap })
      result.value = res.data
    } else {
      const validKeys = unbindKeys.value.filter(k => k.trim())
      if (validKeys.length === 0) {
        ElMessage.warning('请至少填写一个标签键')
        submitting.value = false
        return
      }
      const res = await unbindTagsApi({ resources: dummyResources, tag_keys: validKeys })
      result.value = res.data
    }
    emit('success')
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleClose = () => {
  visible.value = false
  batchType.value = 'bind'
  tagPairs.value = [{ key: '', value: '' }]
  unbindKeys.value = ['']
  result.value = null
}
</script>

<style scoped lang="scss">
.target-summary {
  background: var(--el-fill-color-light);
  border-radius: 8px;
  padding: 12px;
  font-size: 13px;
  color: var(--text-secondary);
  width: 100%;
  strong { color: var(--text-primary); }
}

.tag-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  width: 100%;
  .el-input { flex: 1; }
}

.batch-result {
  margin-top: 12px;
}
</style>
