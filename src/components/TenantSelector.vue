<template>
  <el-select
    v-if="tenants.length > 1"
    :model-value="userStore.currentTenantId"
    placeholder="选择租户"
    :style="{ width }"
    :loading="switching"
    @change="onSwitch"
  >
    <el-option
      v-for="t in tenants"
      :key="t.id"
      :label="t.name"
      :value="t.id"
    />
  </el-select>
  <span v-else class="tenant-current" :style="{ width }">
    {{ currentName }}
  </span>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { switchTenant } from '@/api/eiam-tenant'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

interface Props {
  width?: string
}
withDefaults(defineProps<Props>(), { width: '200px' })

const userStore = useUserStore()
const switching = ref(false)

const tenants = computed(() => userStore.tenants)
const currentName = computed(() => {
  const t = tenants.value.find((x) => x.id === userStore.currentTenantId)
  return t?.name || `租户 #${userStore.currentTenantId}`
})

const onSwitch = async (targetId: number | string) => {
  const id = typeof targetId === 'number' ? targetId : Number(targetId)
  if (!id || id === userStore.currentTenantId) return
  switching.value = true
  try {
    await switchTenant(id)
    // eiam 已重签 JWT（session 租户变更）；reload 触发路由守卫重新 fetchUserInfo，
    // 后续 cam 数据自动落到新租户。
    window.location.reload()
  } catch (e: any) {
    ElMessage.error(e?.message || '切换租户失败')
  } finally {
    switching.value = false
  }
}
</script>

<style scoped lang="scss">
.tenant-current {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}
</style>
