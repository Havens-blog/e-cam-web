<template>
  <div class="task-detail-page">
    <h1>任务详情</h1>
    <p>任务ID: {{ taskId }}</p>
    <p>此页面将在任务11中实现</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const taskId = computed(() => route.params.id)
</script>

<style scoped lang="scss">
.task-detail-page {
  padding: 20px;
}
</style>
