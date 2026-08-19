<template>
  <el-drawer
    :model-value="visible"
    size="480px"
    class="cert-resource-drawer"
    :with-header="false"
    aria-label="引用资源详情"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
  >
    <div v-if="item && group" class="drawer-inner" role="dialog" aria-label="引用资源详情">
      <div class="drawer-header">
        <h3 class="drawer-title mono">{{ item.resourceId }}</h3>
        <button type="button" class="drawer-close" aria-label="关闭抽屉" @click="close">×</button>
      </div>
      <div class="drawer-body">
        <dl class="kv">
          <dt>资源 ID</dt>
          <dd class="mono">{{ item.resourceId }}</dd>
          <dt>云 / 产品</dt>
          <dd>{{ groupLabel(group) }}</dd>
          <dt v-if="group.clusterId">集群</dt>
          <dd v-if="group.clusterId" class="mono">{{ group.clusterId }}</dd>
          <dt v-if="item.namespace">命名空间</dt>
          <dd v-if="item.namespace" class="mono">{{ item.namespace }}</dd>
          <dt v-if="item.kind">资源类型</dt>
          <dd v-if="item.kind" class="mono">{{ item.kind }}</dd>
          <dt>云账号</dt>
          <dd>{{ item.accountKey || '—' }}</dd>
          <dt>云侧证书 ID</dt>
          <dd class="mono">{{ item.referencedCloudCertId }}</dd>
        </dl>
      </div>
      <div class="drawer-footer">
        <el-button class="full-width" @click="close">关闭</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * 引用资源抽屉（ui-design Interactions：点击引用资源行 → 右侧抽屉展示资源要素，
 * 资源 ID/云账号/云侧证书 ID 字段原文，Drawer z30 宽 480px）。
 * el-drawer 自带焦点陷阱（首入可交互元素、Tab 不溢出）与 Esc 关闭。
 */
import type { CertReferenceGroup, CertReferenceItem } from '@/api/cert'
import { groupLabel } from '../format'

defineProps<{
    visible: boolean
    item: CertReferenceItem | null
    group: CertReferenceGroup | null
}>()

const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

function close() {
    emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: -16px;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-base);
}

.drawer-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  word-break: break-all;
}

.drawer-close {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;

  &:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.05);
  }
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.drawer-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border-base);
}

.full-width {
  width: 100%;
}

.kv {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 10px 16px;
  margin: 0;

  dt {
    font-size: 13px;
    color: var(--text-secondary);
  }

  dd {
    margin: 0;
    font-size: 13px;
    color: var(--text-primary);
    word-break: break-all;
  }
}

.mono {
  font-family: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}
</style>
