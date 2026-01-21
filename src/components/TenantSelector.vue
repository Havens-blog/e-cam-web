<template>
  <el-select
    :model-value="modelValue"
    placeholder="选择租户"
    filterable
    clearable
    :style="{ width }"
    @update:model-value="handleChange"
  >
    <el-option
      v-for="tenant in tenants"
      :key="tenant.id"
      :label="tenant.display_name || tenant.name"
      :value="tenant.id"
    >
      <div class="tenant-option">
        <span class="tenant-name">{{ tenant.display_name || tenant.name }}</span>
        <span class="tenant-id">{{ tenant.id }}</span>
      </div>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { listTenantsApi } from '@/api/iam'
import type { Tenant } from '@/api/types/iam'
import { onMounted, ref } from 'vue'

interface Props {
  modelValue?: string
  width?: string
}

interface Emits {
  (e: 'update:modelValue', value: string | undefined): void
}

const props = withDefaults(defineProps<Props>(), {
  width: '200px'
})

const emit = defineEmits<Emits>()

const tenants = ref<Tenant[]>([])

const loadTenants = async () => {
  try {
    const res = await listTenantsApi({ page: 1, size: 100 })
    tenants.value = res.data.data || []
  } catch (error) {
    console.error('加载租户列表失败:', error)
  }
}

const handleChange = (value: string | undefined) => {
  emit('update:modelValue', value)
}

onMounted(() => {
  loadTenants()
})
</script>

<style scoped lang="scss">
.tenant-option {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .tenant-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tenant-id {
    margin-left: 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
