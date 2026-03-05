<template>
  <!-- 触发按钮 -->
  <div class="icon-select-trigger" @click="dialogVisible = true">
    <img v-if="isImageUrl(modelValue)" :src="modelValue" class="trigger-img" />
    <IconFont v-else-if="modelValue" :type="modelValue" :size="20" />
    <el-icon v-else class="trigger-placeholder"><Grid /></el-icon>
    <span class="trigger-text">{{ modelValue ? getDisplayName(modelValue) : '选择图标' }}</span>
    <el-icon class="trigger-arrow"><ArrowDown /></el-icon>
  </div>

  <!-- 图标选择弹窗 -->
  <el-dialog v-model="dialogVisible" title="选择图标" width="640px" :close-on-click-modal="true" append-to-body>
    <div class="icon-select-dialog">
      <!-- 类型切换 -->
      <el-radio-group v-model="activeTab" size="default" class="tab-group">
        <el-radio-button value="common">常用</el-radio-button>
        <el-radio-button value="linear">线性</el-radio-button>
        <el-radio-button value="fill">实底</el-radio-button>
        <el-radio-button value="color">多色</el-radio-button>
        <el-radio-button value="url">图片地址</el-radio-button>
      </el-radio-group>

      <!-- 图片地址输入 -->
      <div v-if="activeTab === 'url'" class="url-input-area">
        <el-input v-model="imageUrl" placeholder="输入图片URL或base64" type="textarea" :rows="3" />
        <div v-if="imageUrl" class="url-preview">
          <img :src="imageUrl" class="preview-img" @error="previewError = true" @load="previewError = false" />
          <span :class="['preview-status', { error: previewError }]">{{ previewError ? '加载失败' : '预览正常' }}</span>
        </div>
      </div>

      <!-- 常用图标 -->
      <div v-else-if="activeTab === 'common'" class="icon-scroll-area">
        <div class="icon-grid">
          <div v-for="icon in commonIconList" :key="icon.value"
            :class="['icon-cell', { selected: modelValue === icon.value }]"
            @click="selectIcon(icon.value)">
            <IconFont :type="icon.value" :size="28" />
            <span class="icon-label">{{ icon.label }}</span>
          </div>
        </div>
      </div>

      <!-- 分类图标 -->
      <div v-else class="icon-scroll-area">
        <div v-for="group in currentList" :key="group.label" class="icon-category">
          <div class="category-title">{{ group.label }}</div>
          <div class="icon-grid">
            <div v-for="icon in group.list" :key="icon.value"
              :class="['icon-cell', { selected: modelValue === icon.value }]"
              @click="selectIcon(icon.value)">
              <IconFont :type="icon.value" :size="28" />
              <span class="icon-label">{{ icon.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="selected-preview" v-if="modelValue">
          <span class="preview-label">当前：</span>
          <img v-if="isImageUrl(modelValue)" :src="modelValue" class="mini-preview" />
          <IconFont v-else :type="modelValue" :size="18" />
          <span class="preview-name">{{ getDisplayName(modelValue) }}</span>
        </div>
        <div class="footer-actions">
          <el-button v-if="modelValue" text type="danger" size="small" @click="clearIcon">清除图标</el-button>
          <el-button v-if="activeTab === 'url'" type="primary" :disabled="!imageUrl || previewError" @click="selectImageUrl">确认使用图片</el-button>
          <el-button @click="dialogVisible = false">关闭</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import IconFont from '@/components/IconFont/index.vue';
import { ArrowDown, Grid } from '@element-plus/icons-vue';
import { computed, ref } from 'vue';
import { commonIconList, fillIconList, linearIconList, multicolorIconList } from './constants';

defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; change: [value: string] }>()

const dialogVisible = ref(false)
const activeTab = ref('common')
const imageUrl = ref('')
const previewError = ref(false)

const currentList = computed(() => {
  if (activeTab.value === 'linear') return linearIconList
  if (activeTab.value === 'fill') return fillIconList
  if (activeTab.value === 'color') return multicolorIconList
  return []
})

const isImageUrl = (v: string) => {
  if (!v) return false
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:image/')
}

const getDisplayName = (v: string) => {
  if (isImageUrl(v)) return '自定义图片'
  const flat = [
    ...commonIconList,
    ...linearIconList.flatMap(g => g.list),
    ...fillIconList.flatMap(g => g.list),
    ...multicolorIconList.flatMap(g => g.list),
  ]
  return flat.find(i => i.value === v)?.label || v
}

const selectIcon = (value: string) => {
  emit('update:modelValue', value)
  emit('change', value)
  dialogVisible.value = false
}

const selectImageUrl = () => {
  if (imageUrl.value && !previewError.value) {
    emit('update:modelValue', imageUrl.value)
    emit('change', imageUrl.value)
    dialogVisible.value = false
  }
}

const clearIcon = () => {
  emit('update:modelValue', '')
  emit('change', '')
}
</script>

<style scoped lang="scss">
.icon-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 8px;
  background: var(--el-fill-color-blank, #fff);
  cursor: pointer;
  transition: all 200ms ease;
  min-width: 180px;
  height: 32px;

  &:hover {
    border-color: var(--el-color-primary, #409eff);
  }

  .trigger-img { width: 20px; height: 20px; border-radius: 4px; object-fit: contain; }
  .trigger-placeholder { font-size: 16px; color: var(--el-text-color-placeholder, #a8abb2); }
  .trigger-text {
    flex: 1;
    font-size: 13px;
    color: var(--el-text-color-regular, #606266);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .trigger-arrow { font-size: 12px; color: var(--el-text-color-placeholder, #a8abb2); }
}

.icon-select-dialog {
  .tab-group { margin-bottom: 16px; }

  .icon-scroll-area {
    max-height: 400px;
    overflow-y: auto;
    padding-right: 4px;
  }

  .icon-category {
    margin-bottom: 16px;
    .category-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-text-color-secondary, #909399);
      margin-bottom: 8px;
      padding-left: 2px;
    }
  }

  .icon-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 8px;
  }

  .icon-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 6px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
    border: 2px solid transparent;
    min-height: 72px;

    .icon-label {
      font-size: 11px;
      color: var(--el-text-color-secondary, #909399);
      text-align: center;
      line-height: 1.2;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &:hover {
      background: var(--el-fill-color-light, #f5f7fa);
    }
    &.selected {
      border-color: var(--el-color-primary, #409eff);
      background: var(--el-color-primary-light-9, #ecf5ff);
      .icon-label { color: var(--el-color-primary, #409eff); font-weight: 500; }
    }
  }

  .url-input-area {
    .url-preview {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 12px;
      padding: 10px;
      background: var(--el-fill-color-lighter, #fafafa);
      border-radius: 8px;
      .preview-img { width: 48px; height: 48px; border-radius: 6px; object-fit: contain; border: 1px solid var(--el-border-color-lighter); }
      .preview-status { font-size: 13px; color: var(--el-color-success, #67c23a); &.error { color: var(--el-color-danger, #f56c6c); } }
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .selected-preview {
    display: flex;
    align-items: center;
    gap: 6px;
    .preview-label { font-size: 12px; color: var(--el-text-color-secondary); }
    .mini-preview { width: 18px; height: 18px; border-radius: 3px; object-fit: contain; }
    .preview-name { font-size: 13px; color: var(--el-text-color-regular); }
  }

  .footer-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}
</style>
