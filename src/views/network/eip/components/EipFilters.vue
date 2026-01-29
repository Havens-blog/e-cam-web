<template>
  <div class="eip-filters">
    <el-form :inline="true" :model="filters" class="filters-form">
      <el-form-item>
        <el-input
          v-model="filters.name"
          placeholder="搜索名称或IP地址"
          clearable
          @input="handleSearchInput"
          style="width: 300px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item>
        <el-select v-model="filters.provider" placeholder="云厂商" clearable @change="handleChange" style="width: 120px">
          <el-option v-for="p in CLOUD_PROVIDERS" :key="p.value" :label="p.label" :value="p.value" />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-select v-model="filters.region" placeholder="区域" clearable filterable @change="handleChange" style="width: 140px">
          <el-option v-for="r in regionOptions" :key="r.value" :label="r.label" :value="r.value" />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-select v-model="filters.status" placeholder="状态" clearable @change="handleChange" style="width: 120px">
          <el-option label="已绑定" value="InUse" />
          <el-option label="未绑定" value="Available" />
        </el-select>
      </el-form-item>

      <el-form-item>
        <el-button @click="handleReset"><el-icon><RefreshLeft /></el-icon></el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { RefreshLeft, Search } from '@element-plus/icons-vue'
import { computed, reactive, ref, watch } from 'vue'

interface Filters {
  provider?: string
  region?: string
  status?: string
  name?: string
}

const props = defineProps<{ modelValue: Filters }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Filters): void
  (e: 'search'): void
}>()

const filters = reactive<Filters>({ ...props.modelValue })
const searchTimer = ref<number | null>(null)

const regionOptions = computed(() => {
  if (filters.provider) {
    const config = PROVIDER_CONFIGS[filters.provider as keyof typeof PROVIDER_CONFIGS]
    return config?.regions || []
  }
  const allRegions: { value: string; label: string }[] = []
  Object.values(PROVIDER_CONFIGS).forEach((config: any) => {
    config.regions?.forEach((r: any) => {
      if (!allRegions.find(ar => ar.value === r.value)) allRegions.push(r)
    })
  })
  return allRegions
})

watch(() => props.modelValue, (newVal) => Object.assign(filters, newVal), { deep: true })
watch(() => filters.provider, () => { filters.region = '' })

const handleChange = () => {
  emit('update:modelValue', { ...filters })
  emit('search')
}

const handleSearchInput = () => {
  emit('update:modelValue', { ...filters })
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = window.setTimeout(() => emit('search'), 500)
}

const handleReset = () => {
  Object.assign(filters, { provider: '', region: '', status: '', name: '' })
  emit('update:modelValue', { ...filters })
  emit('search')
}
</script>

<style scoped lang="scss">
.eip-filters {
  padding: 12px 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  margin-bottom: 16px;

  .filters-form {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    :deep(.el-form-item) { margin-bottom: 0; margin-right: 0; }
  }
}
</style>
