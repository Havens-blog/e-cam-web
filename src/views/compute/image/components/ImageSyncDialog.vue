<template>
  <el-dialog
    :model-value="visible"
    title="同步镜像"
    width="600px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form ref="formRef" :model="syncForm" :rules="rules" label-width="100px">
      <el-form-item label="云厂商" prop="provider">
        <el-select v-model="syncForm.provider" placeholder="请选择云厂商" style="width: 100%" @change="handleProviderChange">
          <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="区域">
        <el-select v-model="syncForm.regions" multiple placeholder="留空表示同步所有区域" style="width: 100%" clearable filterable>
          <el-option v-for="r in regionOptions" :key="r.value" :label="r.label" :value="r.value" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="syncing" @click="handleSubmit">开始同步</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { submitSyncAssetsTaskApi } from '@/api'
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const router = useRouter()
const syncing = ref(false)
const formRef = ref<FormInstance>()
const syncForm = reactive({ provider: '', regions: [] as string[] })

// 字段级校验（iter157 修复）：原来只有 `<el-form-item required>`，它仅渲染必填星号、
// **不做任何校验**；提交时空表单只弹一条游离 toast「请选择云厂商」，
// 字段既不标红也不显示错误文案，用户得自己从 toast 反推是哪个字段。
// 改为标准 rules，让错误就地显示在「云厂商」下方并自动标红。
const rules = reactive<FormRules>({
  provider: [{ required: true, message: '请选择云厂商', trigger: 'change' }],
})

const regionOptions = computed(() => {
  if (!syncForm.provider) return []
  const config = PROVIDER_CONFIGS[syncForm.provider as keyof typeof PROVIDER_CONFIGS]
  return config?.regions || []
})

const handleProviderChange = () => {
  syncForm.regions = []
  // 选了厂商就清掉必填错误，避免错误文案挂在已修好的字段上
  formRef.value?.clearValidate('provider')
}

watch(() => props.visible, (val) => {
  if (val) {
    syncForm.provider = ''
    syncForm.regions = []
    formRef.value?.clearValidate()
  }
})

const handleSubmit = async () => {
  // 先走字段级校验：不通过则错误自动显示在对应字段下方，不再弹游离 toast
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  syncing.value = true
  try {
    const { data } = await submitSyncAssetsTaskApi({
      provider: syncForm.provider,
      asset_types: ['image'],
      regions: syncForm.regions.length > 0 ? syncForm.regions : undefined,
    })
    ElMessage.success(`同步任务已提交，任务ID: ${data.task_id}`)
    emit('update:visible', false)
    router.push(`/tasks/${data.task_id}`)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '提交同步任务失败'
    ElMessage.error(msg)
  } finally {
    syncing.value = false
  }
}
</script>
