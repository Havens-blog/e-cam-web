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
  padding: calc(2rem + 0.4vw);
  background: white;
  border-radius: calc(0.4rem + 0.1vw);
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px 0 rgba(0, 0, 0, 0.06);

  .empty-icon {
    color: #d1d5db;
  }

  .empty-actions {
    display: flex;
    gap: calc(0.5rem + 0.1vw);
    justify-content: center;
    margin-top: calc(1rem + 0.2vw);
  }

  .empty-tips {
    margin-top: calc(1.5rem + 0.3vw);
    padding: calc(1rem + 0.2vw);
    background: #f9fafb;
    border-radius: calc(0.4rem + 0.1vw);
    text-align: left;
    max-width: 500px;
    margin-left: auto;
    margin-right: auto;

    p {
      font-weight: 600;
      margin-bottom: calc(0.5rem + 0.1vw);
      color: #374151;
    }

    ul {
      margin: 0;
      padding-left: calc(1.2rem + 0.2vw);
      color: #6b7280;
      font-size: calc(0.7rem + 0.1vw);

      li {
        margin: calc(0.3rem + 0.05vw) 0;
      }
    }
  }
}
</style>
