<template>
  <el-dialog
    :model-value="visible"
    title="同步镜像"
    width="600px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <el-form :model="syncForm" label-width="100px">
      <el-form-item label="云厂商" required>
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
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const router = useRouter()
const syncing = ref(false)
const syncForm = reactive({ provider: '', regions: [] as string[] })

const regionOptions = computed(() => {
  if (!syncForm.provider) return []
  const config = PROVIDER_CONFIGS[syncForm.provider as keyof typeof PROVIDER_CONFIGS]
  return config?.regions || []
})

const handleProviderChange = () => {
  syncForm.regions = []
}

watch(() => props.visible, (val) => {
  if (val) {
    syncForm.provider = ''
    syncForm.regions = []
  }
})

const handleSubmit = async () => {
  if (!syncForm.provider) {
    ElMessage.warning('请选择云厂商')
    return
  }
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
