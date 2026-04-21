<template>
  <el-dialog v-model="visible" title="🏷️ 添加标签" width="600px" :destroy-on-close="true" @close="handleClose">
    <el-form ref="formRef" :model="form" label-position="top">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
        <el-form-item label="云厂商" required>
          <el-select v-model="form.provider" placeholder="请选择云厂商" style="width: 100%" @change="handleProviderChange">
            <el-option label="阿里云" value="aliyun" />
            <el-option label="AWS" value="aws" />
            <el-option label="华为云" value="huawei" />
            <el-option label="腾讯云" value="tencent" />
            <el-option label="火山引擎" value="volcano" />
          </el-select>
        </el-form-item>
        <el-form-item label="云账号" required>
          <el-select v-model="form.account_id" placeholder="请选择云账号" style="width: 100%">
            <el-option v-for="acc in accountOptions" :key="acc.value" :label="acc.label" :value="acc.value" />
          </el-select>
        </el-form-item>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px">
        <el-form-item label="区域" required>
          <el-select v-model="form.region" placeholder="请选择区域" style="width: 100%" filterable>
            <el-option v-for="r in regionOptions" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="资源类型" required>
          <el-select v-model="form.resource_type" placeholder="请选择资源类型" style="width: 100%">
            <el-option label="ECS" value="ecs" />
            <el-option label="RDS" value="rds" />
            <el-option label="Redis" value="redis" />
            <el-option label="VPC" value="vpc" />
            <el-option label="MongoDB" value="mongodb" />
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="选择资源" required>
        <div class="resource-select-area">
          <el-tag
            v-for="rid in form.resource_ids"
            :key="rid"
            closable
            style="margin: 0 4px 4px 0"
            @close="removeResource(rid)"
          >{{ rid }}</el-tag>
          <el-input
            v-model="resourceInput"
            placeholder="输入资源ID后回车添加"
            size="small"
            style="width: 200px"
            @keyup.enter="addResource"
          />
        </div>
      </el-form-item>
      <el-form-item label="标签" required>
        <div v-for="(pair, idx) in form.tags" :key="idx" class="tag-input-group">
          <el-input v-model="pair.key" placeholder="标签键 (如: env)" />
          <el-input v-model="pair.value" placeholder="标签值 (如: production)" />
          <el-button circle size="small" @click="removeTagPair(idx)" :disabled="form.tags.length <= 1">
            ✕
          </el-button>
        </div>
        <el-button type="primary" link size="small" style="margin-top: 4px" @click="addTagPair">
          ＋ 添加更多标签
        </el-button>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">确认绑定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { bindTagsApi } from '@/api/tag';
import { PROVIDER_CONFIGS } from '@/utils/constants';
import { ElMessage } from 'element-plus';
import { computed, reactive, ref, watch } from 'vue';

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'success'): void
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => { emit('update:modelValue', v) })

const submitting = ref(false)
const resourceInput = ref('')

const form = reactive({
  provider: '',
  account_id: 0,
  region: '',
  resource_type: '',
  resource_ids: [] as string[],
  tags: [{ key: '', value: '' }] as { key: string; value: string }[],
})

const accountOptions = ref<{ value: number; label: string }[]>([])

const regionOptions = computed(() => {
  if (!form.provider) return []
  const config = PROVIDER_CONFIGS[form.provider as keyof typeof PROVIDER_CONFIGS]
  return config?.regions || []
})

const handleProviderChange = () => {
  form.region = ''
  form.account_id = 0
  // In production, load accounts from API based on provider
  accountOptions.value = []
}

const addResource = () => {
  const id = resourceInput.value.trim()
  if (id && !form.resource_ids.includes(id)) {
    form.resource_ids.push(id)
  }
  resourceInput.value = ''
}

const removeResource = (rid: string) => {
  form.resource_ids = form.resource_ids.filter(r => r !== rid)
}

const addTagPair = () => {
  form.tags.push({ key: '', value: '' })
}

const removeTagPair = (idx: number) => {
  if (form.tags.length > 1) form.tags.splice(idx, 1)
}

const handleSubmit = async () => {
  // Validate
  if (!form.provider || !form.region || !form.resource_type) {
    ElMessage.warning('请填写完整的资源信息')
    return
  }
  if (form.resource_ids.length === 0) {
    ElMessage.warning('请至少选择一个资源')
    return
  }
  const validTags = form.tags.filter(t => t.key.trim() && t.value.trim())
  if (validTags.length === 0) {
    ElMessage.warning('请至少填写一组有效的标签键值对')
    return
  }

  submitting.value = true
  try {
    const tagsMap: Record<string, string> = {}
    validTags.forEach(t => { tagsMap[t.key.trim()] = t.value.trim() })

    await bindTagsApi({
      resources: form.resource_ids.map(rid => ({
        account_id: form.account_id,
        region: form.region,
        resource_type: form.resource_type,
        resource_id: rid,
      })),
      tags: tagsMap,
    })
    ElMessage.success('标签绑定成功')
    emit('success')
    handleClose()
  } catch (err: any) {
    ElMessage.error(err?.message || '绑定失败')
  } finally {
    submitting.value = false
  }
}

const handleClose = () => {
  visible.value = false
  form.provider = ''
  form.account_id = 0
  form.region = ''
  form.resource_type = ''
  form.resource_ids = []
  form.tags = [{ key: '', value: '' }]
}
</script>

<style scoped lang="scss">
.resource-select-area {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  min-height: 80px;
  background: var(--el-fill-color-lighter);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.tag-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  width: 100%;

  .el-input { flex: 1; }
}
</style>
