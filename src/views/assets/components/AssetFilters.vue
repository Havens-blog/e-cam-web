<template>
  <div class="asset-filters">
    <el-form :inline="true" :model="filters" class="filters-form">
      <el-form-item label="云厂商">
        <el-select
          v-model="filters.provider"
          placeholder="全部"
          clearable
          @change="handleChange"
        >
          <el-option
            v-for="p in CLOUD_PROVIDERS"
            :key="p.value"
            :label="p.label"
            :value="p.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="资产类型">
        <el-select
          v-model="filters.asset_type"
          placeholder="全部"
          clearable
          @change="handleChange"
        >
          <el-option
            v-for="t in ASSET_TYPES"
            :key="t.value"
            :label="t.label"
            :value="t.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="区域">
        <el-input
          v-model="filters.region"
          placeholder="输入区域"
          clearable
          @input="handleSearchInput"
          style="width: 150px"
        />
      </el-form-item>

      <el-form-item label="状态">
        <el-select
          v-model="filters.status"
          placeholder="全部"
          clearable
          @change="handleChange"
        >
          <el-option
            v-for="s in ASSET_STATUS"
            :key="s.value"
            :label="s.label"
            :value="s.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="资产名称">
        <el-input
          v-model="filters.asset_name"
          placeholder="搜索资产名称"
          clearable
          @input="handleSearchInput"
          style="width: 200px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import {
  ASSET_STATUS,
  ASSET_TYPES,
  CLOUD_PROVIDERS,
} from '@/utils/constants'
import { Search } from '@element-plus/icons-vue'
import { reactive, ref, watch } from 'vue'

interface Filters {
  provider?: string
  asset_type?: string
  region?: string
  status?: string
  asset_name?: string
}

interface Emits {
  (e: 'update:modelValue', value: Filters): void
  (e: 'search'): void
}

const props = defineProps<{
  modelValue: Filters
}>()

const emit = defineEmits<Emits>()

const filters = reactive<Filters>({ ...props.modelValue })
const searchTimer = ref<number | null>(null)

// 监听 props 变化
watch(
  () => props.modelValue,
  (newVal) => {
    Object.assign(filters, newVal)
  },
  { deep: true }
)

// 立即触发搜索（下拉框变化）
const handleChange = () => {
  emit('update:modelValue', { ...filters })
  emit('search')
}

// 防抖搜索（输入框变化）
const handleSearchInput = () => {
  emit('update:modelValue', { ...filters })
  
  if (searchTimer.value) {
    clearTimeout(searchTimer.value)
  }
  
  searchTimer.value = window.setTimeout(() => {
    emit('search')
  }, 500)
}

// 重置筛选
const handleReset = () => {
  filters.provider = ''
  filters.asset_type = ''
  filters.region = ''
  filters.status = ''
  filters.asset_name = ''
  emit('update:modelValue', { ...filters })
  emit('search')
}
</script>

<style scoped lang="scss">
.asset-filters {
  padding: 16px 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  margin-bottom: 20px;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  .filters-form {
    margin: 0;

    :deep(.el-form-item) {
      margin-bottom: 0;
      
      .el-form-item__label {
        color: var(--text-secondary);
      }
    }
  }
}
</style>
