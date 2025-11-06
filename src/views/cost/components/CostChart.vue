<template>
  <ChartCard
    title="成本趋势"
    :option="chartOption"
    :loading="loading"
    height="400px"
  />
</template>

<script setup lang="ts">
import type { DailyCost } from '@/api/types/cost'
import ChartCard from '@/components/ChartCard.vue'
import { generateLineChartOption } from '@/utils/chart-options'
import { computed } from 'vue'

interface Props {
  data: DailyCost[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const chartOption = computed(() => {
  if (!props.data || props.data.length === 0) return undefined
  return generateLineChartOption(props.data, undefined, '日期', '成本（元）')
})
</script>
