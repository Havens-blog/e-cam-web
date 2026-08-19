<template>
  <section class="step2" aria-labelledby="step2-title">
    <div class="card intro-card">
      <h2 id="step2-title">前置校验</h2>
      <p class="text-secondary intro-desc">进入本步自动执行扫描新鲜度与 SAN 覆盖预检。</p>
    </div>

    <!-- 整步 loading（骨架 + 预检执行中；自动执行，完成自动出结果） -->
    <template v-if="loading">
      <div class="card skeleton-card" aria-label="预检执行中">
        <span class="spinner" aria-hidden="true" />
        <span class="text-secondary">预检执行中（扫描新鲜度 + SAN 覆盖）……</span>
      </div>
      <div class="card skeleton-line-card" aria-hidden="true">
        <div class="skeleton-line" />
        <div class="skeleton-line short" />
      </div>
    </template>

    <!-- 通过：双预检卡（新鲜度 + SAN） -->
    <template v-else-if="changeList && !error">
      <div class="card pass-card">
        <div class="row">
          <span class="chg-badge tone-success"><span class="badge-icon" aria-hidden="true">✓</span>通过</span>
          <h3>扫描新鲜度</h3>
        </div>
        <p class="text-secondary text-sm">
          清单绑定扫描快照生成于 {{ changeList.scanFreshnessHrs }}h 前，在新鲜度阈值内。
        </p>
      </div>
      <div class="card pass-card">
        <div class="row">
          <span class="chg-badge tone-success"><span class="badge-icon" aria-hidden="true">✓</span>通过</span>
          <h3>SAN 覆盖预检</h3>
        </div>
        <p class="text-secondary text-sm">新证书 SAN ⊇ 旧证书目标域名集合，可覆盖全部引用。</p>
        <p v-if="changeList.sanCheck.newSans.length > 0" class="text-secondary text-sm">
          新增域名（提示性，不拦截）：{{ changeList.sanCheck.newSans.join('、') }}
        </p>
      </div>
    </template>

    <!-- 阻断卡（按错误码分流：扫描超期→立即扫描 / SAN / 在途互斥 / 仅指纹 / 通用） -->
    <div v-else-if="block" class="card block-card" role="alert">
      <div class="block-banner" :class="`kind-${block.kind}`">
        <span class="block-icon" aria-hidden="true">{{ block.kind === 'mutex' ? '⚠' : '✗' }}</span>
        <div>
          <div class="block-title">{{ block.title }}</div>
          <div class="block-body">{{ block.body }}</div>
          <div v-if="block.kind === 'san'" class="block-body mono">
            {{ error?.message }}
          </div>
        </div>
      </div>
      <div class="block-actions">
        <el-button v-if="block.action === 'scan'" type="primary" :disabled="scanSubmitting" @click="$emit('scan')">
          {{ scanSubmitting ? '扫描中…' : '立即扫描' }}
        </el-button>
        <el-button
          v-if="block.action === 'view-order'"
          class="btn-secondary"
          @click="$emit('view-orders')"
        >
          查看在途变更单
        </el-button>
        <el-button v-if="block.action !== 'scan'" class="btn-secondary" @click="$emit('back')">
          返回上一步
        </el-button>
        <el-button v-if="block.action === 'scan'" class="btn-secondary" @click="$emit('back')">
          返回上一步
        </el-button>
        <el-button v-if="block.kind === 'error'" class="btn-secondary" @click="$emit('retry')">
          重试
        </el-button>
      </div>
    </div>

    <!-- 无结果且无错误（重入）：触发预检 -->
    <div v-else class="card">
      <el-button type="primary" @click="$emit('retry')">开始预检</el-button>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Step2 前置校验（AC3）：进入自动执行（父级 runPrecheck），整步 loading；
 * 通过 → 扫描新鲜度 + SAN 双通过卡；阻断 → 按错误码分流阻断卡：
 * 扫描超期（立即扫描引导）/ SAN 不满足 / 在途互斥（跳转变更管理列表寻源单）/
 * 新证书仅指纹提示。挂载时无结果自动触发预检（含从失败重试后重入）。
 */
import type { ChangeList } from '@/api/cert'
import { computed, onMounted, ref } from 'vue'
import { precheckBlockFromError } from '../../format'

const props = defineProps<{
    loading: boolean
    error: { code: string; message: string } | null
    changeList: ChangeList | null
}>()

const emit = defineEmits<{
    (e: 'retry'): void
    (e: 'scan'): void
    (e: 'back'): void
    (e: 'view-orders'): void
}>()

const block = computed(() => (props.error ? precheckBlockFromError(props.error.code) : null))

const scanSubmitting = ref(false)

onMounted(() => {
    // 自动执行预检（无结果且非 loading 时触发；父级防重入）
    if (!props.changeList && !props.error && !props.loading) {
        emit('retry')
    }
})
</script>

<style lang="scss" scoped>
.step2 {
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

.intro-card {
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.intro-desc {
  margin: 8px 0 0;
  font-size: 13px;
}

.skeleton-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.skeleton-line-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line {
  height: 16px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.06), transparent);
    animation: step2-wave 1.2s ease-in-out infinite;
  }

  &.short {
    width: 60%;
  }
}

@keyframes step2-wave {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid color-mix(in srgb, #0070f3 30%, transparent);
  border-top-color: #0070f3;
  border-radius: 50%;
  animation: step2-spin 0.8s linear infinite;
  flex: none;
}

@keyframes step2-spin {
  to {
    transform: rotate(360deg);
  }
}

.pass-card {
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  p {
    margin: 8px 0 0;
  }
}

.block-card {
  border-color: color-mix(in srgb, #ee0000 40%, transparent);
}

.block-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.block-icon {
  color: #ee0000;
  font-size: 18px;
  line-height: 1.4;
}

.block-title {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
}

.block-body {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 4px;
}

.block-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
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
  flex: none;

  .badge-icon {
    font-size: 11px;
  }

  &.tone-success {
    color: #50e3c2;
    border-color: color-mix(in srgb, #50e3c2 40%, transparent);
  }
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 13px;
}

.mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }

  .skeleton-line::after {
    animation: none;
  }
}
</style>
