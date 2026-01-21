<template>
  <el-drawer
    :model-value="visible"
    title="关系详情"
    size="480px"
    :close-on-click-modal="true"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template v-if="relation">
      <div class="detail-content">
        <div class="detail-section">
          <div class="section-header">
            <div class="relation-avatar blue">
              <el-icon :size="24"><Connection /></el-icon>
            </div>
            <div class="relation-title">
              <h3>{{ relation.name }}</h3>
              <code class="relation-uid">{{ relation.uid }}</code>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4 class="section-title">关系信息</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">源模型</span>
              <code class="info-code">{{ relation.source_uid }}</code>
            </div>
            <div class="info-item">
              <span class="info-label">目标模型</span>
              <code class="info-code">{{ relation.target_uid }}</code>
            </div>
            <div class="info-item">
              <span class="info-label">关系类型</span>
              <span class="type-badge" :class="getTypeClass(relation.relation_type)">
                {{ getTypeLabel(relation.relation_type) }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">方向</span>
              <span class="info-value">{{ getDirectionLabel(relation.direction) }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="relation.source_to_target || relation.target_to_source">
          <h4 class="section-title">关系描述</h4>
          <div class="relation-desc">
            <div v-if="relation.source_to_target" class="desc-item">
              <span class="desc-direction">源 → 目标:</span>
              <span class="desc-text">{{ relation.source_to_target }}</span>
            </div>
            <div v-if="relation.target_to_source" class="desc-item">
              <span class="desc-direction">目标 → 源:</span>
              <span class="desc-text">{{ relation.target_to_source }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section" v-if="relation.description">
          <h4 class="section-title">备注</h4>
          <p class="description-text">{{ relation.description }}</p>
        </div>

        <div class="detail-section">
          <h4 class="section-title">时间信息</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">创建时间</span>
              <span class="info-value">{{ formatTime(relation.create_time) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">更新时间</span>
              <span class="info-value">{{ formatTime(relation.update_time) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="$emit('update:visible', false)">关闭</el-button>
        <el-button type="primary" :disabled="!relation" @click="relation && $emit('edit', relation)">
          <el-icon><Edit /></el-icon>
          编辑
        </el-button>
        <el-button type="danger" plain :disabled="!relation" @click="relation && $emit('delete', relation)">
          <el-icon><Delete /></el-icon>
          删除
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import type { ModelRelationVO } from '@/api/types/cmdb';
import { Connection, Delete, Edit } from '@element-plus/icons-vue';

defineProps<{
  visible: boolean
  relation: ModelRelationVO | null
}>()

defineEmits<{
  'update:visible': [value: boolean]
  edit: [relation: ModelRelationVO]
  delete: [relation: ModelRelationVO]
}>()

const getTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    belongs_to: '归属',
    contains: '包含',
    bindto: '绑定',
    connects: '连接',
    depends_on: '依赖',
  }
  return map[type] || type
}

const getTypeClass = (type: string) => {
  const map: Record<string, string> = {
    belongs_to: 'green',
    contains: 'blue',
    bindto: 'purple',
    connects: 'orange',
    depends_on: 'cyan',
  }
  return map[type] || 'blue'
}

const getDirectionLabel = (direction: string) => {
  const map: Record<string, string> = {
    one_to_one: '一对一',
    one_to_many: '一对多',
    many_to_many: '多对多',
    many_to_one: '多对一',
  }
  return map[direction] || direction || '-'
}

const formatTime = (time: number | undefined) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.detail-content { padding: 0 4px; }

.detail-section {
  margin-bottom: 24px;

  .section-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;

    .relation-avatar {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      &.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
    }

    .relation-title {
      h3 {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 4px 0;
      }
      .relation-uid {
        font-size: 13px;
        color: var(--text-tertiary);
        font-family: var(--font-mono);
        background: var(--bg-hover);
        padding: 2px 8px;
        border-radius: 4px;
      }
    }
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 12px 0;
  }

  .description-text {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .info-label { font-size: 12px; color: var(--text-muted); }
  .info-value { font-size: 14px; color: var(--text-primary); }
  .info-code {
    font-size: 13px;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: var(--bg-hover);
    padding: 4px 8px;
    border-radius: 6px;
    display: inline-block;
  }
}

.type-badge {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;

  &.green { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
  &.blue { background: rgba(59, 130, 246, 0.15); color: var(--accent-blue); }
  &.purple { background: rgba(139, 92, 246, 0.15); color: var(--accent-purple); }
  &.orange { background: rgba(245, 158, 11, 0.15); color: var(--accent-yellow); }
  &.cyan { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
}

.relation-desc {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .desc-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bg-hover);
    border-radius: 8px;

    .desc-direction {
      font-size: 12px;
      color: var(--text-tertiary);
      white-space: nowrap;
    }
    .desc-text {
      font-size: 14px;
      color: var(--text-primary);
    }
  }
}

.drawer-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
</style>
