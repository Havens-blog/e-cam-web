<template>
  <div class="database-filters">
    <div class="filters-left">
      <el-form :inline="true" :model="filters" class="filters-form">
        <el-form-item>
          <el-input
            v-model="filters.name"
            placeholder="默认为名称搜索，点击区域和IP搜索更多，IP仅支持全匹配"
            clearable
            @input="handleSearchInput"
            style="width: 350px"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-select
            v-model="filters.provider"
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
            v-model="filters.region"
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
            v-model="filters.status"
            placeholder="状态"
            clearable
            @change="handleChange"
            style="width: 120px"
          >
            <el-option
              v-for="s in DATABASE_STATUS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
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
      <el-button size="small" circle @click="$emit('export')" title="导出">
        <el-icon><Download /></el-icon>
      </el-button>
      <el-button size="small" circle @click="$emit('column-settings')" title="自定义列">
        <el-icon><Setting /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { Download, Refresh, RefreshLeft, Search, Setting } from '@element-plus/icons-vue'
import { computed, reactive, ref, watch } from 'vue'

interface Filters {
  provider?: string
  region?: string
  status?: string
  name?: string
}

interface Emits {
  (e: 'update:modelValue', value: Filters): void
  (e: 'search'): void
  (e: 'refresh'): void
  (e: 'export'): void
  (e: 'column-settings'): void
}

const DATABASE_STATUS = [
  { value: 'running', label: '运行中' },
  { value: 'stopped', label: '已停止' },
  { value: 'creating', label: '创建中' },
  { value: 'deleting', label: '删除中' },
]

const props = defineProps<{
  modelValue: Filters
}>()

const emit = defineEmits<Emits>()

const filters = reactive<Filters>({ ...props.modelValue })
const searchTimer = ref<number | null>(null)

// 根据选中的云厂商获取区域列表
const regionOptions = computed(() => {
  if (filters.provider) {
    const config = PROVIDER_CONFIGS[filters.provider as keyof typeof PROVIDER_CONFIGS]
    return config?.regions || []
  }
  // 返回所有云厂商的区域
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

watch(
  () => props.modelValue,
  (newVal) => {
    Object.assign(filters, newVal)
  },
  { deep: true }
)

// 云厂商变化时清空区域
watch(() => filters.provider, () => {
  filters.region = ''
})

const handleChange = () => {
  emit('update:modelValue', { ...filters })
  emit('search')
}

const handleSearchInput = () => {
  emit('update:modelValue', { ...filters })
  
  if (searchTimer.value) {
    clearTimeout(searchTimer.value)
  }
  
  searchTimer.value = window.setTimeout(() => {
    emit('search')
  }, 500)
}

const handleReset = () => {
  filters.provider = ''
  filters.region = ''
  filters.status = ''
  filters.name = ''
  emit('update:modelValue', { ...filters })
  emit('search')
}
</script>

<style scoped lang="scss">
.database-filters {
  padding: 12px 16px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  margin-bottom: 16px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
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
