<template>
  <!--
    用户页头部：标题 + 右侧三个动作按钮。
    拆分来源：src/views/iam/users/index.vue 原模板 3-25 行。
    三个动作全部以事件上抛，本组件不持有任何页面状态（无 props）。
  -->
  <div class="page-header">
    <div class="header-content">
      <div class="header-info">
        <h1 class="page-title">云账号用户</h1>
        <p class="page-subtitle">管理从云账号同步的 IAM / RAM 子用户（云账号维度，非平台登录账号）</p>
      </div>
      <div class="header-actions">
        <el-button class="action-btn" @click="emit('export')">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button class="action-btn" @click="emit('sync')">
          <el-icon><Refresh /></el-icon>
          同步用户
        </el-button>
        <el-button type="primary" class="action-btn primary" @click="emit('add')">
          <el-icon><Plus /></el-icon>
          创建用户
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, Plus, Refresh } from '@element-plus/icons-vue'

/** 头部动作事件：与拆分前父组件上的三个 click 处理器一一对应 */
const emit = defineEmits<{
  (e: 'export'): void
  (e: 'sync'): void
  (e: 'add'): void
}>()
</script>

<style scoped lang="scss">
// 页面头部（CSS 逐字搬迁自 index.vue 原 style 的 `.page-header` 块）
.page-header {
  margin-bottom: 24px;

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;

    @media (max-width: 768px) {
      flex-direction: column;
    }
  }

  .header-info {
    .page-title {
      font-size: 28px;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 14px;
      color: var(--text-tertiary);
      margin: 0;
    }
  }

  .header-actions {
    display: flex;
    gap: 10px;
    flex-shrink: 0;

    .action-btn {
      height: 38px;
      padding: 0 16px;
      border-radius: 10px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      transition: all 200ms ease;

      &:hover {
        background: var(--bg-hover);
        border-color: var(--border-strong);
      }

      &.primary {
        background: var(--accent-blue);
        border-color: var(--accent-blue);
        color: white;

        &:hover {
          background: #828fff;
          border-color: #828fff;
        }
      }
    }
  }
}

/* IAM_USERS_MOBILE_NO_OVERFLOW：360 下三个操作按钮合计 316px，内容区仅约 272px */
@media (max-width: 768px) {
  .header-actions {
    flex-wrap: wrap;
    width: 100%;
  }
}
</style>
