<template>
  <el-tooltip :content="osLabel" placement="top">
    <span class="os-icon-circle" :class="osClass">
      <el-icon :size="iconSize"><Monitor /></el-icon>
    </span>
  </el-tooltip>
</template>

<script lang="ts">
/**
 * 根据 os_type / platform 返回图标名称
 * 导出供属性测试使用
 */
export function getOsIconName(osType: string, platform?: string): string {
  const p = (platform || '').toLowerCase()
  if (p.includes('centos')) return 'centos'
  if (p.includes('ubuntu')) return 'ubuntu'
  if (p.includes('debian')) return 'debian'
  if (p.includes('redhat') || p.includes('rhel')) return 'redhat'
  if (p.includes('suse')) return 'suse'
  if (p.includes('windows')) return 'windows'
  if (p.includes('coreos')) return 'coreos'
  if (p.includes('aliyun')) return 'aliyun-linux'

  const t = (osType || '').toLowerCase()
  if (t === 'windows') return 'windows'
  if (t === 'linux') return 'linux'
  return 'unknown'
}
</script>

<script setup lang="ts">
import { Monitor } from '@element-plus/icons-vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  osType?: string
  platform?: string
  size?: number
}>(), {
  osType: '',
  platform: '',
  size: 16,
})

const iconSize = computed(() => Math.round(props.size * 0.7))

const osClass = computed(() => {
  const name = getOsIconName(props.osType, props.platform)
  if (name === 'centos') return 'os-centos'
  if (name === 'ubuntu') return 'os-ubuntu'
  if (name === 'windows') return 'os-windows'
  if (name === 'debian') return 'os-debian'
  if (name === 'redhat' || name === 'rhel') return 'os-redhat'
  if (name === 'linux' || name === 'aliyun-linux' || name === 'coreos' || name === 'suse') return 'os-linux'
  return 'os-unknown'
})

const osLabel = computed(() => {
  if (props.platform) return props.platform
  if (props.osType) {
    const t = props.osType.toLowerCase()
    if (t === 'linux') return 'Linux'
    if (t === 'windows') return 'Windows'
    return props.osType
  }
  return '未知'
})
</script>

<style scoped lang="scss">
.os-icon-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: v-bind("props.size + 'px'");
  height: v-bind("props.size + 'px'");
  border-radius: 50%;
  color: #fff;
  flex-shrink: 0;
  transition: transform 0.2s;

  &:hover { transform: scale(1.1); }

  &.os-centos { background: linear-gradient(135deg, #9333ea, #7c3aed); }
  &.os-ubuntu { background: linear-gradient(135deg, #f97316, #ea580c); }
  &.os-windows { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
  &.os-debian { background: linear-gradient(135deg, #ec4899, #db2777); }
  &.os-redhat { background: linear-gradient(135deg, #ef4444, #dc2626); }
  &.os-linux { background: linear-gradient(135deg, #eab308, #ca8a04); }
  &.os-unknown { background: linear-gradient(135deg, #6b7280, #4b5563); }
}
</style>
