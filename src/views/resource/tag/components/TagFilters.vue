<template>
  <div class="tag-filters">
    <div class="filters-left">
      <el-input
        v-model="localFilters.keyword"
        placeholder="搜索标签键或标签值..."
        clearable
        size="large"
        class="search-input"
        @input="handleSearchInput"
      >
        <template #prefix>
          <el-icon :size="18"><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="localFilters.provider" placeholder="全部云厂商" clearable @change="handleChange" style="width: 130px">
        <el-option label="阿里云" value="aliyun" />
        <el-option label="AWS" value="aws" />
        <el-option label="华为云" value="huawei" />
        <el-option label="腾讯云" value="tencent" />
        <el-option label="火山引擎" value="volcano" />
      </el-select>
      <el-select v-model="localFilters.resource_type" placeholder="全部资源类型" clearable @change="handleChange" style="width: 130px">
        <el-option label="ECS" value="ecs" />
        <el-option label="RDS" value="rds" />
        <el-option label="Redis" value="redis" />
        <el-option label="MongoDB" value="mongodb" />
        <el-option label="VPC" value="vpc" />
        <el-option label="EIP" value="eip" />
        <el-option label="OSS" value="oss" />
        <el-option label="NAS" value="nas" />
      </el-select>
      <el-button @click="handleReset" circle>
        <el-icon><RefreshLeft /></el-icon>
      </el-button>
    </div>
    <div class="filters-right">
      <el-button size="small" @click="$emit('export')">
        📥 导出
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshLeft, Search } from '@element-plus/icons-vue'
import { reactive, ref, watch } from 'vue'

export interface TagFilterValues {
  keyword: string
  provider: string
  resource_type: string
}

const props = defineProps<{ modelValue: TagFilterValues }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: TagFilterValues): void
  (e: 'search'): void
  (e: 'export'): void
}>()

const localFilters = reactive<TagFilterValues>({
  keyword: props.modelValue.keyword || '',
  provider: props.modelValue.provider || '',
  resource_type: props.modelValue.resource_type || '',
})

const searchTimer = ref<number | null>(null)

watch(() => props.modelValue, (newVal) => { Object.assign(localFilters, newVal) }, { deep: true })

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
  Object.assign(localFilters, { keyword: '', provider: '', resource_type: '' })
  emit('update:modelValue', { ...localFilters })
  emit('search')
}
</script>

<style scoped lang="scss">
.tag-filters {
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
    width: 280px;
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
</style>
