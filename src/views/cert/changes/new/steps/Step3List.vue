<template>
  <section class="step3" aria-labelledby="step3-title">
    <!-- 清单生成失败：错误提示 + 重试（不阻断返回上一步） -->
    <div v-if="loadError" class="card error-card" role="alert">
      <div class="error-title">
        <span class="error-icon" aria-hidden="true">⚠</span>清单生成失败
      </div>
      <p class="text-secondary text-sm">{{ loadError }}</p>
      <div class="error-actions">
        <el-button type="primary" @click="$emit('retry')">重试</el-button>
        <el-button class="btn-secondary" @click="$emit('back')">返回上一步</el-button>
      </div>
    </div>

    <template v-else-if="changeList">
      <!-- 盲区声���横幅常驻（不可关闭） -->
      <el-alert type="warning" :closable="false" show-icon class="blindspot-banner">
        <template #title>盲区声明</template>
        本清单不含 VM Nginx 配置级引用，需在变更后人工核对。
        <template v-if="changeList.warnings.length > 0">
          <div v-for="w in changeList.warnings" :key="w" class="warning-line">{{ w }}</div>
        </template>
      </el-alert>

      <!-- 元数据行：快照时间 + 可执行/不可执行计数 -->
      <div class="meta-row">
        <span class="meta-item">清单绑定扫描快照：{{ changeList.scanFreshnessHrs }}h 前</span>
        <span class="meta-dot" aria-hidden="true">·</span>
        <span class="meta-item">可执行项 {{ partition.executable.length }}</span>
        <span class="meta-dot" aria-hidden="true">·</span>
        <span class="meta-item">不可执行项 {{ partition.blocked.length }}</span>
      </div>

      <h3 class="section-title">可执行项</h3>
      <div class="card flush-card">
        <el-table :data="partition.executable" class="mini-table" aria-label="可执行项清单">
          <el-table-column label="资源" min-width="180">
            <template #default="{ row }">
              <span class="mono">{{ row.target.resourceId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="云 / 产品" min-width="150">
            <template #default="{ row }">{{ targetLocationLabel(row.target) }}</template>
          </el-table-column>
          <el-table-column label="计划动作" width="130">
            <template #default="{ row }">{{ actionLabel(row.action) }}</template>
          </el-table-column>
        </el-table>
        <div v-if="partition.executable.length === 0" class="no-items">无可执行项</div>
      </div>

      <!-- 不可执行项分区：Warning 底色 + 原因 + 出路（不静默放行） -->
      <h3 class="section-title">不可执行项 / 不可自动变更</h3>
      <div class="card blocked-card">
        <el-table :data="partition.blocked" class="mini-table blocked-table" aria-label="不可执行项清单">
          <el-table-column label="资源" min-width="180">
            <template #default="{ row }">
              <span class="mono">{{ row.target.resourceId }}</span>
            </template>
          </el-table-column>
          <el-table-column label="云 / 产品" min-width="150">
            <template #default="{ row }">{{ targetLocationLabel(row.target) }}</template>
          </el-table-column>
          <el-table-column label="原因" min-width="220">
            <template #default="{ row }">
              <span class="reason-text">{{ row.reason || '不可自动变更' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="出路" min-width="180">
            <template #default="{ row }">{{ blockedExit(row.reason) }}</template>
          </el-table-column>
        </el-table>
        <div v-if="partition.blocked.length === 0" class="no-items">无不可执行项</div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
/**
 * Step3 变更清单（AC3）：可执行项表格 + 不可执行项分区（Warning 底色 +
 * 原因 + 出路）+ 盲区横幅常驻 + 快照时间。生成失败可重试可返回上一步。
 * Hard Rule：执行期间清单快照固定——本步为只读呈现，无任何清单项增删入口。
 */
import type { ChangeList } from '@/api/cert'
import { computed } from 'vue'
import { actionLabel, blockedExit, partitionListItems, targetLocationLabel } from '../../format'

const props = defineProps<{
    changeList: ChangeList | null
    loadError?: string
}>()

defineEmits<{
    (e: 'retry'): void
    (e: 'back'): void
}>()

const partition = computed(() => partitionListItems(props.changeList?.items ?? []))
</script>

<style lang="scss" scoped>
.step3 {
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

.flush-card {
  padding: 0;
  overflow: hidden;
}

.blocked-card {
  padding: 0;
  overflow: hidden;
  background: color-mix(in srgb, #f5a623 6%, var(--glass-bg, #111111));
  border-color: color-mix(in srgb, #f5a623 25%, transparent);
}

.mini-table {
  --el-table-border-color: var(--border-base);
  --el-table-header-bg-color: rgba(255, 255, 255, 0.05);
  --el-table-row-hover-bg-color: rgba(255, 255, 255, 0.05);
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-primary);

  :deep(th.el-table__cell) {
    font-weight: 500;
  }
}

.blindspot-banner {
  border-radius: 8px;
}

.warning-line {
  margin-top: 4px;
  font-size: 12px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-item {
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-dot {
  color: var(--text-secondary);
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}

.reason-text {
  color: var(--text-secondary);
  font-size: 13px;
  word-break: break-all;
}

.no-items {
  padding: 16px 24px;
  color: var(--text-secondary);
  font-size: 13px;
}

.error-card {
  border-color: color-mix(in srgb, #ee0000 40%, transparent);
}

.error-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 14px;
}

.error-icon {
  color: #ee0000;
}

.error-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-sm {
  font-size: 13px;
}
</style>
