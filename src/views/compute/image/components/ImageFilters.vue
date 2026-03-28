<template>
  <div class="image-filters">
    <div class="filters-left">
      <el-input
        v-model="localFilters.name"
        placeholder="搜索镜像名称或ID"
        clearable
        size="large"
        class="search-input"
        @input="handleSearchInput"
      >
        <template #prefix>
          <el-icon :size="18"><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="localFilters.os_type" placeholder="操作系统" clearable @change="handleChange" style="width: 130px">
        <el-option label="Linux" value="linux" />
        <el-option label="Windows" value="windows" />
      </el-select>
      <el-select v-model="localFilters.status" placeholder="状态" clearable @change="handleChange" style="width: 130px">
        <el-option label="可用" value="Available" />
        <el-option label="创建中" value="Creating" />
        <el-option label="不可用" value="UnAvailable" />
      </el-select>
      <el-select v-model="localFilters.region" placeholder="区域" clearable filterable @change="handleChange" style="width: 150px">
        <el-option v-for="r in regionOptions" :key="r.value" :label="r.label" :value="r.value" />
      </el-select>
      <el-button @click="handleReset" circle>
        <el-icon><RefreshLeft /></el-icon>
      </el-button>
    </div>
    <div class="filters-right">
      <div class="view-toggle">
        <el-tooltip content="列表视图" placement="top">
          <button
            class="view-btn"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'; $emit('viewChange', 'list')"
          >
            <el-icon :size="16"><List /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip content="网格视图" placement="top">
          <button
            class="view-btn"
            :class="{ active: viewMode === 'grid' }"
            @click="viewMode = 'grid'; $emit('viewChange', 'grid')"
          >
            <el-icon :size="16"><Grid /></el-icon>
          </button>
        </el-tooltip>
      </div>
      <el-button circle @click="$emit('refresh')" title="刷新">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PROVIDER_CONFIGS } from '@/utils/constants'
import { Grid, List, Refresh, RefreshLeft, Search } from '@element-plus/icons-vue'
import { computed, reactive, ref, watch } from 'vue'

export interface ImageFilterValues {
  provider: string
  region: string
  status: string
  name: string
  os_type: string
  image_owner_alias: string
  account_id: number
}

const props = defineProps<{ modelValue: ImageFilterValues }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: ImageFilterValues): void
  (e: 'search'): void
  (e: 'refresh'): void
  (e: 'viewChange', mode: string): void
}>()

const viewMode = ref('list')

const localFilters = reactive<ImageFilterValues>({
  provider: props.modelValue.provider || '',
  region: props.modelValue.region || '',
  status: props.modelValue.status || '',
  name: props.modelValue.name || '',
  os_type: props.modelValue.os_type || '',
  image_owner_alias: props.modelValue.image_owner_alias || '',
  account_id: props.modelValue.account_id || 0,
})
const searchTimer = ref<number | null>(null)

const regionOptions = computed(() => {
  if (localFilters.provider) {
    const config = PROVIDER_CONFIGS[localFilters.provider as keyof typeof PROVIDER_CONFIGS]
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

watch(() => props.modelValue, (newVal) => { Object.assign(localFilters, newVal) }, { deep: true })
watch(() => localFilters.provider, () => { localFilters.region = '' })

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
  Object.assign(localFilters, {
    provider: localFilters.provider,
    region: '',
    status: '',
    name: '',
    os_type: '',
    image_owner_alias: localFilters.image_owner_alias,
    account_id: localFilters.account_id,
  })
  emit('update:modelValue', { ...localFilters })
  emit('search')
}
</script>

<style scoped lang="scss">
.image-filters {
  padding: 14px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.filters-left {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  .search-input {
    width: 300px;
    :deep(.el-input__wrapper) {
      border-radius: 10px;
    }
  }
}

.filters-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.view-toggle {
  display: flex;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  overflow: hidden;

  .view-btn {
    padding: 7px 12px;
    background: transparent;
    color: var(--text-tertiary);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      color: var(--text-secondary);
      background: var(--el-fill-color-light);
    }

    &.active {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }

    & + .view-btn {
      border-left: 1px solid var(--glass-border);
    }
  }
}
</style>
