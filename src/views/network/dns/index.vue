<template>
  <PageContainer>
    <div class="dns-page">
      <div class="page-header">
        <!-- 原为 <div>，页面缺少 <h1>；.page-title 已显式定义 24px/700，改为 h1 视觉不变 -->
        <h1 class="page-title">DNS 管理</h1>
        <div class="page-desc">统一管理多云平台的 DNS 域名和解析记录</div>
      </div>

      <DnsStatsCards ref="statsRef" />
      <DomainTable ref="tableRef" />
    </div>
  </PageContainer>
</template>

<script setup lang="ts">
import PageContainer from '@/components/PageContainer/index.vue'
import { ref } from 'vue'
import DnsStatsCards from './components/DnsStatsCards.vue'
import DomainTable from './components/DomainTable.vue'

const statsRef = ref<InstanceType<typeof DnsStatsCards>>()
const tableRef = ref<InstanceType<typeof DomainTable>>()
</script>

<style scoped lang="scss">
.dns-page {
  padding: 24px 32px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.page-desc {
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
