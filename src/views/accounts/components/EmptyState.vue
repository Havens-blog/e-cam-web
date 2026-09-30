<template>
  <div class="empty-state">
    <el-empty :description="description">
      <template #image>
        <div class="empty-icon">
          <el-icon :size="80"><Box /></el-icon>
        </div>
      </template>
      <template #default>
        <div class="empty-actions">
          <el-button v-if="showAddButton" type="primary" @click="$emit('add')">
            <el-icon><Plus /></el-icon>
            添加账号
          </el-button>
          <el-button v-if="showClearFilter" @click="$emit('clear-filter')">
            清除筛选条件
          </el-button>
        </div>
        <div v-if="showTips" class="empty-tips">
          <p>💡 提示：</p>
          <ul>
            <li>点击"添加账号"按钮创建第一个云账号</li>
            <li>支持阿里云、AWS、Azure、腾讯云、华为云等多个云平台</li>
            <li>添加后可以自动同步云资产信息</li>
          </ul>
        </div>
      </template>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { Box, Plus } from '@element-plus/icons-vue'

interface Props {
  description?: string
  showAddButton?: boolean
  showClearFilter?: boolean
  showTips?: boolean
}

withDefaults(defineProps<Props>(), {
  description: '暂无云账号',
  showAddButton: true,
  showClearFilter: false,
  showTips: true,
})

defineEmits<{
  add: []
  'clear-filter': []
}>()
</script>

<style scoped lang="scss">
.empty-state {
  padding: 32px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  .empty-icon {
    color: var(--text-tertiary);
  }

  .empty-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 16px;
  }

  .empty-tips {
    margin-top: 24px;
    padding: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    text-align: left;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;

    p {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }

    ul {
      margin: 0;
      padding-left: 20px;
      color: var(--text-secondary);
      font-size: 13px;

      li {
        margin: 6px 0;
      }
    }
  }
}
</style>
