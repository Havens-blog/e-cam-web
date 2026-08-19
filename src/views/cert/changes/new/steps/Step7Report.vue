<template>
  <section class="step7" aria-labelledby="step7-title">
    <!-- 终态卡（已完成 / 部分完成 / 回滚失败 / 已回滚 / 已取消） -->
    <div class="card final-card">
      <div class="row">
        <span
          class="chg-badge"
          :class="`tone-${changeStatusMeta(status).tone}`"
        >
          <span v-if="changeStatusMeta(status).spinner" class="spinner" aria-hidden="true" />
          <span v-else class="badge-icon" aria-hidden="true">{{ changeStatusMeta(status).icon }}</span>
          {{ changeStatusMeta(status).label }}
        </span>
        <h2 id="step7-title">{{ finalTitle }}</h2>
      </div>
      <p class="text-secondary final-desc">{{ finalDesc }}</p>
      <div v-if="protectDays > 0" class="meta-row">
        <span class="badge-protect">
          <span class="badge-icon" aria-hidden="true">🔒</span>保护期剩余 {{ protectDays }} 天
        </span>
      </div>
    </div>

    <!-- 部分完成：仍在保护期内可回滚成功项（Hard Rule 三态之一） -->
    <div v-if="status === 'partial_completed' && protectDays > 0" class="row actions-row">
      <el-button class="btn-secondary" @click="rollbackVisible = true">回滚成功项</el-button>
      <el-button type="primary" tag="router-link" :to="reportPath">查看变更报告</el-button>
    </div>
    <div v-else class="row actions-row">
      <el-button type="primary" tag="router-link" :to="reportPath">查看变更报告</el-button>
    </div>

    <RollbackModal
      v-model:visible="rollbackVisible"
      :order-id="orderId"
      :scope-items="scopeItems"
      @rolled-back="reloadScope"
    />
  </section>
</template>

<script setup lang="ts">
/**
 * Step7 报告入口（AC5）：终态卡（状态���章 + 结论文案 + 保护期剩余徽章）+
 * 「查看变更报告」跳报告详情页；部分完成且保护期内 → 成功项回滚入口
 * （Hard Rule 三态之一；范围=详情项中 success 项，提交后刷新范围）。
 */
import type { ChangeDetailItem, ChangeStatus } from '@/api/cert'
import { getChangeApi } from '@/api/cert'
import { computed, onMounted, ref } from 'vue'
import { changeStatusMeta } from '../../../detail/format'
import RollbackModal from '../../components/RollbackModal.vue'
import { rollbackScopeRows, rowProtectDaysLeft } from '../../format'

const props = defineProps<{
    orderId: string
    status: ChangeStatus
    protectUntil?: string | null
}>()

defineEmits<{ (e: 'go-report'): void }>()

const rollbackVisible = ref(false)
const detailItems = ref<ChangeDetailItem[]>([])

/** 回滚范围：仅成功项（失败项引用未被改动，无需回滚） */
const scopeItems = computed(() => rollbackScopeRows(detailItems.value))

async function reloadScope() {
    try {
        detailItems.value = (await getChangeApi(props.orderId)).items
    } catch {
        /* 刷新失败保留旧范围 */
    }
}

onMounted(() => {
    if (props.status === 'partial_completed') void reloadScope()
})

const protectDays = computed(() => rowProtectDaysLeft(props.protectUntil))
const reportPath = computed(() => `/certs/changes/${encodeURIComponent(props.orderId)}`)

const finalTitle = computed(() => {
    switch (props.status) {
        case 'completed':
            return '变更完成'
        case 'partial_completed':
            return '部分完成'
        case 'rollback_failed':
            return '回滚失败'
        case 'rolled_back':
            return '已回滚'
        default:
            return '变更已结束'
    }
})

const finalDesc = computed(() => {
    switch (props.status) {
        case 'completed':
            return '全部清单项达标，变更报告已生成。旧证书进入回滚保护期。'
        case 'partial_completed':
            return '验证窗口已关闭，存在未达标/失败项。仍在回滚保护期内，可回滚成功项���'
        case 'rollback_failed':
            return '回滚失败已转人工处理，告警同步触发。请查看变更报告与审计记录。'
        case 'rolled_back':
            return '成功项已回滚至旧证书，变更报告已生成。'
        default:
            return '变更流程已结束，详见变更报告。'
    }
})
</script>

<style lang="scss" scoped>
.step7 {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--glass-bg);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 24px;
}

.final-card {
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.final-desc {
  margin: 8px 0 0;
  font-size: 13px;
}

.meta-row {
  margin-top: 12px;
}

.badge-protect {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #a1a1a1;
  border: 1px solid var(--border-base);
  border-radius: 999px;
  padding: 2px 8px;
}

.actions-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.chg-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;

  .badge-icon {
    font-size: 11px;
  }

  &.tone-success {
    color: #50e3c2;
    border-color: color-mix(in srgb, #50e3c2 40%, transparent);
  }

  &.tone-warning {
    color: #f5a623;
    border-color: color-mix(in srgb, #f5a623 40%, transparent);
  }

  &.tone-error {
    color: #ee0000;
    border-color: color-mix(in srgb, #ee0000 40%, transparent);
  }

  &.tone-verifying {
    color: #8b5cf6;
    border-color: color-mix(in srgb, #8b5cf6 40%, transparent);
  }

  &.tone-secondary {
    color: #a1a1a1;
    border-color: var(--border-base);
  }
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, #0070f3 30%, transparent);
  border-top-color: #0070f3;
  border-radius: 50%;
  animation: step7-spin 0.8s linear infinite;
}

@keyframes step7-spin {
  to {
    transform: rotate(360deg);
  }
}

.text-secondary {
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
