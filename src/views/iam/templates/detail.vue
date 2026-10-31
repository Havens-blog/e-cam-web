<template>
  <div class="iam-template-detail-page">
    <div class="page-header">
      <el-button link @click="goList">
        <el-icon><ArrowLeft /></el-icon>
        返回列表
      </el-button>
      <h1>模板详情</h1>
    </div>

    <el-card v-loading="loading" shadow="never">
      <!-- 不存在：给"返回列表"，不提供无意义的重试 -->
      <el-empty v-if="notFound" description="模板不存在或已被删除" :image-size="90">
        <el-button type="primary" @click="goList">返回列表</el-button>
      </el-empty>

      <!-- 其他失败：可重试 -->
      <el-alert v-else-if="loadError" type="error" :closable="false" show-icon :title="loadError">
        <template #default>
          <el-button type="primary" link @click="fetchDetail">重试</el-button>
        </template>
      </el-alert>

      <template v-else-if="template">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="模板名称">{{ template.name }}</el-descriptions-item>
          <el-descriptions-item label="模板 ID">{{ template.id }}</el-descriptions-item>
          <el-descriptions-item label="分类">{{ categoryLabel(template.category) }}</el-descriptions-item>
          <el-descriptions-item label="类型">
            <el-tag :type="template.is_built_in ? 'info' : 'success'" size="small">
              {{ template.is_built_in ? '内置' : '自定义' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="云平台">
            <el-tag v-for="p in template.cloud_platforms || []" :key="p" size="small" class="platform-tag">
              {{ getProviderLabel(p) }}
            </el-tag>
            <span v-if="!(template.cloud_platforms || []).length">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="租户">{{ template.tenant_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDateTime(template.create_time) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ formatDateTime(template.update_time) }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ template.description || '暂无描述' }}</el-descriptions-item>
        </el-descriptions>

        <h2 class="section-title">包含策略（{{ rows.length }}）</h2>
        <el-table :data="rows" stripe>
          <el-table-column prop="policy_id" label="策略 ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="policy_name" label="策略名称" min-width="200" show-overflow-tooltip />
          <el-table-column label="云平台" width="140">
            <template #default="{ row }">{{ getProviderLabel(row.provider) }}</template>
          </el-table-column>
          <el-table-column prop="policy_type" label="策略类型" width="140" />
          <el-table-column label="策略文档" min-width="220">
            <template #default="{ row }">
              <el-popover v-if="row.policy_document" placement="left" width="520" trigger="click">
                <template #reference>
                  <el-button link type="primary">查看 JSON</el-button>
                </template>
                <pre class="policy-doc">{{ prettyJson(row.policy_document) }}</pre>
              </el-popover>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该模板暂无策略" :image-size="70" />
          </template>
        </el-table>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { getTemplateDetailApi } from '@/api/iam'
import type { PolicyTemplate } from '@/api/types/iam'
import { useDictionary } from '@/composables/useDictionary'
import { getProviderLabel } from '@/utils/constants'
import { formatDateTime } from '@/utils/format'
import { isTemplateNotFound, policyRows, templateErrorMessage, unpackTemplateDetail } from './detail-data'

const route = useRoute()
const router = useRouter()
const { loadDict, getDictLabel } = useDictionary()

const loading = ref(false)
const loadError = ref('')
const notFound = ref(false)
const template = ref<PolicyTemplate | null>(null)

const rows = computed(() => policyRows(template.value?.policies))
const categoryLabel = (value?: string) => (value ? getDictLabel('template_category', value) || value : '-')

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function routeId(): number | null {
  const id = Number(route.params.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

async function fetchDetail() {
  const id = routeId()
  loadError.value = ''
  notFound.value = false
  template.value = null
  if (id === null) {
    notFound.value = true
    return
  }
  loading.value = true
  try {
    const res = await getTemplateDetailApi(id)
    const detail = unpackTemplateDetail(res)
    if (!detail) {
      loadError.value = '模板详情数据不完整，请稍后重试'
      return
    }
    template.value = detail
  } catch (e) {
    // "不存在"与"服务故障"必须区分：前者给返回列表，后者给重试
    if (isTemplateNotFound(e)) notFound.value = true
    else loadError.value = templateErrorMessage(e)
  } finally {
    loading.value = false
  }
}

function goList() {
  router.push('/iam/templates')
}

onMounted(async () => {
  await loadDict('template_category').catch(() => {})
  await fetchDetail()
})

// 详情页内切换 id（如从列表连续查看）必须重新拉取，否则会显示上一个模板
watch(() => route.params.id, () => fetchDetail())
</script>

<style scoped lang="scss">
.iam-template-detail-page {
  padding: 20px;

  .page-header {
    display: flex;
    align-items: center;
    gap: 12px;

    h1 {
      margin: 0;
      font-size: 20px;
    }
  }

  .section-title {
    margin: 20px 0 12px;
    font-size: 16px;
  }

  .platform-tag {
    margin-right: 6px;
  }

  .policy-doc {
    max-height: 360px;
    margin: 0;
    overflow: auto;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-all;
  }
}
</style>
