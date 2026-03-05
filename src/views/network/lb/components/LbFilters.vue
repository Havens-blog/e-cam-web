<template>
  <div class="lb-filters">
    <div class="filters-left">
      <el-form :inline="true" :model="localFilters" class="filters-form">
        <el-form-item>
          <el-input
            v-model="localFilters.name"
            placeholder="搜索负载均衡名称或ID"
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
          <el-select
            v-model="localFilters.provider"
            placeholder="云厂商"
            clearable
            @change="handleChange"
            style="width: 120px"
          >
            <el-option
              v-for="p in CLOUD_PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-select
            v-model="localFilters.region"
            placeholder="区域"
            clearable
            filterable
            @change="handleChange"
            style="width: 140px"
          >
            <el-option
              v-for="r in regionOptions"
              :key="r.value"
              :label="r.label"
              :value="r.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-select
            v-model="localFilters.lb_type"
            placeholder="类型"
            clearable
            @change="handleChange"
            style="width: 120px"
          >
            <el-option label="SLB (传统)" value="slb" />
            <el-option label="ALB (应用)" value="alb" />
            <el-option label="NLB (网络)" value="nlb" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-select
            v-model="localFilters.address_type"
            placeholder="网络类型"
            clearable
            @change="handleChange"
            style="width: 120px"
          >
            <el-option label="公网" value="internet" />
            <el-option label="内网" value="intranet" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button @click="handleReset">
            <el-icon><RefreshLeft /></el-icon>
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="filters-right">
      <el-button size="small" circle @click="$emit('refresh')" title="刷新">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
import { computed, reactive, ref, watch } from 'vue'

interface Filters {
  provider: string
  region: string
  name: string
  lb_type: string
  address_type: string
}

const props = defineProps<{
  modelValue: Filters
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Filters): void
  (e: 'search'): void
  (e: 'refresh'): void
}>()

const localFilters = reactive<Filters>({
  provider: props.modelValue.provider || '',
  region: props.modelValue.region || '',
  name: props.modelValue.name || '',
  lb_type: props.modelValue.lb_type || '',
  address_type: props.modelValue.address_type || '',
})
const searchTimer = ref<number | null>(null)

const regionOptions = computed(() => {
  if (localFilters.provider) {
    const config = PROVIDER_CONFIGS[localFilters.provider as keyof typeof PROVIDER_CONFIGS]
    return config?.regions || []
  }
  const allRegions: { value: string; label: string }[] = []
  Object.values(PROVIDER_CONFIGS).forEach((config: any) => {
    if (config.regions) {
      config.regions.forEach((r: any) => {
        if (!allRegions.find(ar => ar.value === r.value)) {
          allRegions.push(r)
        }
      })
    }
  })
  return allRegions
})

watch(() => props.modelValue, (newVal) => {
  Object.assign(localFilters, newVal)
}, { deep: true })

watch(() => localFilters.provider, () => {
  localFilters.region = ''
})

const handleChange = () => {
  emit('update:modelValue', { ...localFilters })
  emit('search')
}

const handleSearchInput = () => {
  emit('update:modelValue', { ...localFilters })
  if (searchTimer.value) clearTimeout(searchTimer.value)
  searchTimer.value = window.setTimeout(() => emit('search'), 500)
}

const handleReset = () => {
  Object.assign(localFilters, { provider: '', region: '', name: '', lb_type: '', address_type: '' })
  emit('update:modelValue', { ...localFilters })
  emit('search')
}
</script>

<style scoped lang="scss">
.lb-filters {
  padding: 12px 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .filters-left {
    flex: 1;

    .filters-form {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      :deep(.el-form-item) {
        margin-bottom: 0;
        margin-right: 0;
      }
    }
  }

  .filters-right {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
}
</style>
