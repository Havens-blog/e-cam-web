<template>
  <el-dialog
    :model-value="visible"
    :show-close="false"
    width="420px"
    :close-on-click-modal="false"
    class="execute-confirm-dialog"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="dialog-content">
      <div class="icon-wrapper">
        <el-icon class="execute-icon"><VideoPlay /></el-icon>
      </div>
      <h3 class="title">执行规则匹配</h3>
      <p class="description">
        将对所有未绑定的资源执行规则匹配，根据已配置的规则自动将资源绑定到对应的服务树节点。
      </p>
      
      <div class="info-card">
        <div class="info-item">
          <el-icon><Document /></el-icon>
          <span>匹配范围：所有未绑定资源</span>
        </div>
        <div class="info-item">
          <el-icon><Sort /></el-icon>
          <span>执行顺序：按优先级从高到低</span>
        </div>
        <div class="info-item">
          <el-icon><Clock /></el-icon>
          <span>预计耗时：取决于资源数量</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:visible', false)">取消</el-button>
        <el-button type="primary" :loading="loading" @click="$emit('confirm')">
          <el-icon v-if="!loading"><VideoPlay /></el-icon>
          {{ loading ? '执行中...' : '开始执行' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { Clock, Document, Sort, VideoPlay } from '@element-plus/icons-vue';

defineProps<{
  visible: boolean
  loading: boolean
}>()

defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()
</script>

<style scoped lang="scss">
.dialog-content {
  text-align: center;
  padding: 8px 0;

  .icon-wrapper {
    width: 72px;
    height: 72px;
    margin: 0 auto 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05));
    border-radius: 50%;

    .execute-icon {
      font-size: 36px;
      color: var(--accent-blue);
    }
  }

  .title {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .description {
    margin: 0 0 24px;
    font-size: 14px;
    color: var(--text-tertiary);
    line-height: 1.6;
  }

  .info-card {
    background: var(--bg-hover);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 16px;
    text-align: left;

    .info-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      font-size: 13px;
      color: var(--text-secondary);

      .el-icon {
        color: var(--text-tertiary);
        font-size: 16px;
      }

      &:not(:last-child) {
        border-bottom: 1px solid var(--border-subtle);
      }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
