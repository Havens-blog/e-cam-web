<template>
  <el-tag v-if="statusInfo" :type="(statusInfo.color as any)" size="small">
    {{ statusInfo.label }}
  </el-tag>
</template>

<script setup lang="ts">
import { getAssetStatus } from '@/utils/constants';
import { computed } from 'vue';

interface Props {
  status: string
}

const props = defineProps<Props>()

const statusInfo = computed(() => getAssetStatus(props.status))
</script>

<style scoped lang="scss">
.el-tag {
  font-weight: 500;
}
</style>
