<template>
  <el-drawer
    v-model="drawerVisible"
    :title="title"
    :size="size"
    :direction="direction"
    :before-close="handleClose"
    :close-on-click-modal="closeOnClickModal"
    class="detail-drawer"
  >
    <template #header>
      <div class="drawer-header">
        <div class="header-left">
          <el-button
            v-if="showBackButton"
            link
            @click="handleClose"
          >
            <el-icon><ArrowLeft /></el-icon>
            返回
          </el-button>
          <span class="drawer-title">{{ title }}</span>
        </div>
        <div class="header-actions">
          <slot name="header-actions" />
        </div>
      </div>
    </template>

    <div v-loading="loading" class="drawer-content">
      <el-tabs v-if="tabs && tabs.length > 0" v-model="activeTab" class="detail-tabs">
        <el-tab-pane
          v-for="tab in tabs"
          :key="tab.name"
          :label="tab.label"
          :name="tab.name"
        >
          <slot :name="`tab-${tab.name}`" />
        </el-tab-pane>
      </el-tabs>
      <slot v-else />
    </div>

    <template v-if="showFooter" #footer>
      <div class="drawer-footer">
        <slot name="footer">
          <el-button @click="handleClose">关闭</el-button>
        </slot>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { computed } from 'vue'

interface Tab {
  name: string
  label: string
}

interface Props {
  visible: boolean
  title: string
  size?: string | number
  direction?: 'rtl' | 'ltr' | 'ttb' | 'btt'
  loading?: boolean
  tabs?: Tab[]
  activeTabName?: string
  showBackButton?: boolean
  showFooter?: boolean
  closeOnClickModal?: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'update:activeTabName', value: string): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  size: '60%',
  direction: 'rtl',
  loading: false,
  showBackButton: true,
  showFooter: false,
  closeOnClickModal: false
})

const emit = defineEmits<Emits>()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const activeTab = computed({
  get: () => props.activeTabName || (props.tabs?.[0]?.name || ''),
  set: (value) => emit('update:activeTabName', value)
})

const handleClose = () => {
  emit('close')
  emit('update:visible', false)
}
</script>

<style scoped lang="scss">
.detail-drawer {
  :deep(.el-drawer) {
    background: var(--bg-surface);
  }

  :deep(.el-drawer__header) {
    margin-bottom: 0;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
  }

  :deep(.el-drawer__body) {
    padding: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-base);
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;

      .drawer-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;

    .detail-tabs {
      height: 100%;

      :deep(.el-tabs__header) {
        margin: 0;
        padding: 0 20px;
        background: var(--bg-elevated);
        border-bottom: 1px solid var(--border-subtle);
      }

      :deep(.el-tabs__item) {
        color: var(--text-secondary);

        &.is-active {
          color: var(--text-primary);
        }

        &:hover {
          color: var(--text-primary);
        }
      }

      :deep(.el-tabs__content) {
        padding: 20px;
      }

      :deep(.el-tab-pane) {
        height: 100%;
      }
    }
  }

  .drawer-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-elevated);
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
}
</style>
