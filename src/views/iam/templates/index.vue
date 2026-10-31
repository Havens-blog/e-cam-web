<template>
  <div class="iam-templates-page">
    <div class="page-header">
      <div>
        <h1>策略模板管理</h1>
        <p class="page-desc">查看多云 IAM 策略模板（内置模板与自定义模板）。</p>
      </div>
    </div>

    <el-card shadow="never" class="filter-card">
      <div class="filters">
        <el-input
          v-model="filters.keyword"
          placeholder="按模板名称/描述搜索"
          clearable
          style="width: 260px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filters.category" placeholder="全部分类" clearable style="width: 180px" @change="handleSearch">
          <el-option v-for="opt in categoryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <el-select v-model="filters.isBuiltIn" placeholder="全部类型" clearable style="width: 160px" @change="handleSearch">
          <el-option label="内置模板" :value="true" />
          <el-option label="自定义模板" :value="false" />
        </el-select>
        <el-button type="primary" :loading="loading" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </el-card>

    <el-alert
      v-if="loadError"
      class="load-error"
      type="error"
      :closable="false"
      show-icon
      :title="loadError"
    >
      <template #default>
        <el-button type="primary" link @click="fetchList">重试</el-button>
      </template>
    </el-alert>

    <el-card shadow="never">
      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="name" label="模板名称" min-width="200" show-overflow-tooltip />
        <el-table-column label="分类" width="140">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column label="云平台" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="p in row.cloud_platforms || []" :key="p" size="small" class="platform-tag">
              {{ getProviderLabel(p) }}
            </el-tag>
            <span v-if="!(row.cloud_platforms || []).length">-</span>
          </template>
        </el-table-column>
        <el-table-column label="策略数" width="100">
          <template #default="{ row }">{{ policyCount(row) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="row.is_built_in ? 'info' : 'success'" size="small">
              {{ row.is_built_in ? '内置' : '自定义' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.update_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="goDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="emptyText" :image-size="80" />
        </template>
      </el-table>

      <el-pagination
        v-if="total > 0"
        class="pager"
        background
        layout="total, prev, pager, next, sizes"
        :total="total"
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[20, 50, 100]"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from '@element-plus/icons-vue'
import { listTemplatesApi } from '@/api/iam'
import type { PolicyTemplate } from '@/api/types/iam'
import { useDictionary } from '@/composables/useDictionary'
import { getProviderLabel } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import {
  TEMPLATE_PAGE_SIZE,
  buildTemplateListParams,
  policyCount,
  unpackTemplateList,
  type TemplateListFilters,
} from './list-params'

const router = useRouter()
const { loadDict, getDictOptions, getDictLabel } = useDictionary()

const loading = ref(false)
const loadError = ref('')
const rows = ref<PolicyTemplate[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(TEMPLATE_PAGE_SIZE)

const filters = reactive<TemplateListFilters>({ keyword: '', category: '', isBuiltIn: '' })
const hasFilters = computed(() => Boolean((filters.keyword || '').trim() || filters.category || filters.isBuiltIn !== ''))

// 分类下拉走数据字典（constants.ts 里的同名映射已 @deprecated，避免两处口径漂移）。
// 注意：getDictOptions 本身返回 Ref，模板里自动解包，**不要**再包一层 computed。
const categoryOptions = getDictOptions('template_category')
const categoryLabel = (value?: string) => (value ? getDictLabel('template_category', value) || value : '-')
const emptyText = computed(() => (hasFilters.value ? '没有符合条件的模板' : '暂无策略模板'))

async function fetchList() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listTemplatesApi(buildTemplateListParams(filters, page.value, pageSize.value))
    const { rows: list, total: count } = unpackTemplateList(res)
    rows.value = list
    total.value = count
  } catch (e) {
    // 失败必须显式呈现并允许重试，不能静默留空表
    rows.value = []
    total.value = 0
    loadError.value = `策略模板加载失败：${e instanceof Error ? e.message : String(e)}`
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  fetchList()
}

function handleReset() {
  filters.keyword = ''
  filters.category = ''
  filters.isBuiltIn = ''
  page.value = 1
  fetchList()
}

function handlePageChange(next: number) {
  page.value = next
  fetchList()
}

function handleSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  fetchList()
}

function goDetail(row: PolicyTemplate) {
  if (row?.id != null) router.push(`/iam/templates/${row.id}`)
}

onMounted(async () => {
  // 字典加载失败不应阻断列表（分类列退化为原始值）
  await loadDict('template_category').catch(() => {})
  await fetchList()
})
</script>

<style scoped lang="scss">
.iam-templates-page {
  padding: 20px;

  .page-header h1 {
    margin: 0 0 4px;
    font-size: 20px;
  }

  .page-desc {
    margin: 0 0 16px;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .filter-card {
    margin-bottom: 16px;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .load-error {
    margin-bottom: 16px;
  }

  .platform-tag {
    margin-right: 6px;
  }

  .pager {
    margin-top: 16px;
    justify-content: flex-end;
  }
}
</style>
