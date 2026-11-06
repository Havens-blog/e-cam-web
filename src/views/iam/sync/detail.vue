<template>
  <div class="iam-sync-detail-page">
    <h1>同步任务详情</h1>

    <!--
      占位说明（iter237）。
      这个路由此前只有一个「<p>任务 ID: …</p>」，用户无法判断是加载失败、数据为空、
      还是功能未做。这里补成明确的占位态，并告诉用户**去哪儿看真实数据** ——
      写法沿用 iter211 在 InstanceDetailDrawer 里定的模板。
      注意：列表页的「详情」按钮打开的是 TaskDetailDrawer 抽屉（功能完整），
      本页只有直接访问 URL 时才会到达。
    -->
    <el-empty>
      <template #description>
        <p class="placeholder-title">该任务的执行明细暂未接入</p>
        <p class="placeholder-desc">
          本页暂未接入单个任务的执行明细（逐条同步结果、失败原因）。
          可在「IAM 同步」列表中查看任务状态与进度，或在任务行的「详情」抽屉中查看概要。
        </p>
        <p class="placeholder-desc">任务 ID：{{ $route.params.id }}</p>
      </template>
      <el-button type="primary" @click="goBack">返回同步任务列表</el-button>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

/** 返回列表：占位页没有可执行动作，给用户一条明确的出路 */
function goBack() {
  router.push('/iam/sync')
}
</script>

<style scoped lang="scss">
.iam-sync-detail-page {
  padding: 20px;
}

.placeholder-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary, #303133);
}

.placeholder-desc {
  margin: 0 0 6px;
  max-width: 520px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #606266);
}
</style>
