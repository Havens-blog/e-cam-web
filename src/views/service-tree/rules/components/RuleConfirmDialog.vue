<template>
  <el-dialog
    :model-value="modelValue"
    :show-close="false"
    width="440px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="rule-confirm-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dialog-content">
      <div class="icon-wrapper" :class="isDelete ? 'is-danger' : 'is-warning'">
        <el-icon class="confirm-icon">
          <Delete v-if="isDelete" />
          <WarningFilled v-else-if="isDisable" />
          <Link v-else />
        </el-icon>
      </div>

      <h3 class="title">{{ title }}</h3>
      <p class="description">{{ description }}</p>

      <div class="rule-card">
        <div class="rule-name">{{ rule?.name || '-' }}</div>
        <div class="rule-meta">
          <div v-if="rule?.node_name" class="meta-item">
            <span class="meta-label">目标节点</span>
            <span class="meta-value">{{ rule.node_name }}</span>
          </div>
          <div v-if="rule?.env_name" class="meta-item">
            <span class="meta-label">目标环境</span>
            <span class="meta-value">
              <span v-if="rule.env_color" class="env-dot" :style="{ background: rule.env_color }"></span>
              {{ rule.env_name }}
            </span>
          </div>
          <div class="meta-item">
            <span class="meta-label">规则条件</span>
            <span class="meta-value">{{ rule?.conditions?.length ?? 0 }} 条</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">绑定资源</span>
            <span class="meta-value">{{ rule?.binding_count ?? 0 }} 个</span>
          </div>
        </div>

        <div v-if="isDelete" class="cascade-warning">
          <el-icon><WarningFilled /></el-icon>
          <span>该操作不可撤销，将同时解绑此规则绑定的 {{ rule?.binding_count ?? 0 }} 个资源</span>
        </div>
        <div v-else-if="isUnbind" class="rebind-note">
          <el-icon><WarningFilled /></el-icon>
          <span>解绑后若规则仍启用，下次执行规则匹配会重新绑定这些资源</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="emit('update:modelValue', false)">取消</el-button>
        <el-button
          :type="isDelete ? 'danger' : 'warning'"
          :loading="loading"
          @click="emit('confirm')"
        >
          <el-icon v-if="!loading">
            <Delete v-if="isDelete" />
            <WarningFilled v-else-if="isDisable" />
            <Link v-else />
          </el-icon>
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { BindingRule } from '@/api/types/service-tree';
import { Delete, Link, WarningFilled } from '@element-plus/icons-vue';
import { computed } from 'vue';

const props = defineProps<{
  modelValue: boolean
  mode: 'delete' | 'disable' | 'unbind'
  rule: BindingRule | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
}>()

const isDelete = computed(() => props.mode === 'delete')
const isDisable = computed(() => props.mode === 'disable')
const isUnbind = computed(() => props.mode === 'unbind')

const title = computed(() => ({
  delete: '删除绑定规则',
  disable: '禁用绑定规则',
  unbind: '解绑绑定资源'
}[props.mode]))

const description = computed(() => ({
  delete: '删除后该规则绑定的资源将一并解绑，回到未绑定状态。',
  disable: '禁用后该规则将停止自动匹配新资源，已绑定的资源保持不变。',
  unbind: '将解绑该规则名下绑定的所有资源，规则本身保留。'
}[props.mode]))

const confirmText = computed(() => ({
  delete: '删除并解绑',
  disable: '确认禁用',
  unbind: '确认解绑'
}[props.mode]))
</script>

<style scoped lang="scss">
.dialog-content {
  text-align: center;
  padding: 8px 0 0;

  .icon-wrapper {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;

    &.is-danger {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.05));

      .confirm-icon {
        color: #ef4444;
      }
    }

    &.is-warning {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.05));

      .confirm-icon {
        color: #f59e0b;
      }
    }

    .confirm-icon {
      font-size: 32px;
    }
  }

  .title {
    margin: 0 0 10px;
    font-size: 19px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .description {
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--text-tertiary);
    line-height: 1.6;
  }

  .rule-card {
    background: var(--bg-hover);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 16px;
    text-align: left;

    .rule-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);
      word-break: break-all;
    }

    .rule-meta {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .meta-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;

        .meta-label {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .meta-value {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;

          .env-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
          }
        }
      }
    }

    .cascade-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      font-size: 13px;
      line-height: 1.5;
      color: #f87171;

      .el-icon {
        flex-shrink: 0;
      }
    }

    .rebind-note {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 14px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.25);
      font-size: 13px;
      line-height: 1.5;
      color: #fbbf24;

      .el-icon {
        flex-shrink: 0;
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