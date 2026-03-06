<template>
  <div class="cost-filters">
    <div class="filters-left">
      <el-form :inline="true" :model="localFilters" class="filters-form">
        <el-form-item>
          <el-select
            v-model="localFilters.provider"
            placeholder="云厂商"
            clearable
            @change="handleChange"
            style="width: 130px"
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
            v-model="localFilters.account_id"
            placeholder="云账号"
            clearable
            filterable
            @change="handleChange"
            style="width: 160px"
          >
            <el-option
              v-for="a in accountOptions"
              :key="a.value"
              :label="a.label"
              :value="a.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-select
            v-model="localFilters.service_type"
            placeholder="服务类型"
            clearable
            @change="handleChange"
            style="width: 130px"
          >
            <el-option label="计算" value="compute" />
            <el-option label="存储" value="storage" />
            <el-option label="网络" value="network" />
            <el-option label="数据库" value="database" />
            <el-option label="中间件" value="middleware" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-select
            v-model="localFilters.region"
            placeholder="地域"
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
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :shortcuts="dateShortcuts"
            style="width: 260px"
            @change="handleDateChange"
          />
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
import { listCloudAccountsApi } from '@/api'
import { CLOUD_PROVIDERS, PROVIDER_CONFIGS } from '@/utils/constants'
import { Refresh, RefreshLeft } from '@element-plus/icons-vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'

export interface CostFilterValues {
  provider: string
  account_id: number | undefined
  service_type: string
  region: string
  start_date: string
  end_date: string
}

const props = defineProps<{
  modelValue: CostFilterValues
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: CostFilterValues): void
  (e: 'search'): void
  (e: 'refresh'): void
}>()

const localFilters = reactive<CostFilterValues>({
  provider: props.modelValue.provider || '',
  account_id: props.modelValue.account_id,
  service_type: props.modelValue.service_type || '',
  region: props.modelValue.region || '',
  start_date: props.modelValue.start_date || '',
  end_date: props.modelValue.end_date || '',
})

const dateRange = ref<[string, string] | null>(
  localFilters.start_date && localFilters.end_date
    ? [localFilters.start_date, localFilters.end_date]
    : (() => {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
        const s = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
        const e = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        localFilters.start_date = s
        localFilters.end_date = e
        return [s, e] as [string, string]
      })()
)

const accountOptions = ref<{ value: number; label: string }[]>([])

const regionOptions = computed(() => {
  if (localFilters.provider) {
    const config = PROVIDER_CONFIGS[localFilters.provider as keyof typeof PROVIDER_CONFIGS]
    return config?.regions || []
  }
  const allRegions: { value: string; label: string }[] = []
  Object.values(PROVIDER_CONFIGS).forEach((config: any) => {
    config.regions?.forEach((r: any) => {
      if (!allRegions.find(ar => ar.value === r.value)) {
        allRegions.push(r)
      }
    })
  })
  return allRegions
})

const dateShortcuts = [
  {
    text: '本月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth(), 1), now]
    }
  },
  {
    text: '上月',
    value: () => {
      const now = new Date()
      return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)]
    }
  },
  {
    text: '近7天',
    value: () => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(start.getDate() - 7)
      return [start, now]
    }
  },
  {
    text: '近30天',
    value: () => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(start.getDate() - 30)
      return [start, now]
    }
  },
  {
    text: '近90天',
    value: () => {
      const now = new Date()
      const start = new Date(now)
      start.setDate(start.getDate() - 90)
      return [start, now]
    }
  }
]

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

const handleDateChange = (val: [string, string] | null) => {
  localFilters.start_date = val?.[0] || ''
  localFilters.end_date = val?.[1] || ''
  handleChange()
}

const handleReset = () => {
  Object.assign(localFilters, {
    provider: '',
    account_id: undefined,
    service_type: '',
    region: '',
    start_date: '',
    end_date: '',
  })
  dateRange.value = null
  emit('update:modelValue', { ...localFilters })
  emit('search')
}

const fetchAccounts = async () => {
  try {
    const res = await listCloudAccountsApi({ limit: 100, offset: 0 })
    const data = (res as any).data || res
    const list = data.accounts || data.items || []
    accountOptions.value = list.map((a: any) => ({
      value: a.id,
      label: a.name || `账号 ${a.id}`
    }))
  } catch {
    accountOptions.value = []
  }
}

onMounted(() => {
  fetchAccounts()
})
</script>

<style scoped lang="scss">
.cost-filters {
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
