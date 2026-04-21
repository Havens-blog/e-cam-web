<template>
  <div class="cascade-selectors">
    <!-- 云账号 -->
    <el-form-item label="云账号" prop="cloud_account_id">
      <el-select
        v-model="form.cloud_account_id"
        placeholder="请选择云账号"
        filterable
        @change="handleAccountChange"
        style="width: 100%"
      >
        <el-option
          v-for="acc in safeAccountOptions"
          :key="acc.id"
          :label="acc.name"
          :value="acc.id"
        />
      </el-select>
    </el-form-item>

    <!-- 地域 -->
    <el-form-item label="地域" prop="region">
      <el-select
        v-model="form.region"
        placeholder="请选择地域"
        filterable
        :loading="regionLoading"
        @change="handleRegionChange"
        style="width: 100%"
      >
        <el-option
          v-for="r in safeRegionOptions"
          :key="r.id"
          :label="r?.local_name || r?.id"
          :value="r.id"
        />
      </el-select>
    </el-form-item>

    <!-- 可用区 -->
    <el-form-item label="可用区" prop="zone">
      <el-input v-model="form.zone" placeholder="请输入可用区 ID" style="width: 100%" />
    </el-form-item>

    <!-- 实例规格 -->
    <el-form-item label="实例规格" prop="instance_type">
      <el-select
        v-model="form.instance_type"
        placeholder="请选择实例规格"
        filterable
        :loading="specLoading"
        style="width: 100%"
      >
        <el-option
          v-for="it in safeInstanceTypes"
          :key="it.instance_type"
          :label="`${it.instance_type} (${it.cpu}核 / ${it.memory_gb}GB)`"
          :value="it.instance_type"
        />
      </el-select>
    </el-form-item>

    <!-- 镜像 -->
    <el-form-item label="镜像" prop="image_id">
      <el-select
        v-model="form.image_id"
        placeholder="请选择镜像"
        filterable
        :loading="specLoading"
        style="width: 100%"
      >
        <el-option
          v-for="img in safeImages"
          :key="img.image_id"
          :label="`${img?.name} (${img?.os_type})`"
          :value="img.image_id"
        />
      </el-select>
    </el-form-item>

    <!-- VPC -->
    <el-form-item label="VPC" prop="vpc_id">
      <el-select
        v-model="form.vpc_id"
        placeholder="请选择 VPC"
        filterable
        :loading="specLoading"
        @change="handleVPCChange"
        style="width: 100%"
      >
        <el-option
          v-for="vpc in safeVPCs"
          :key="vpc.vpc_id"
          :label="`${vpc?.vpc_name || vpc?.vpc_id} (${vpc?.cidr_block})`"
          :value="vpc.vpc_id"
        />
      </el-select>
    </el-form-item>

    <!-- 子网 -->
    <el-form-item label="子网/交换机" prop="subnet_id">
      <el-select
        v-model="form.subnet_id"
        placeholder="请选择子网"
        filterable
        :loading="subnetLoading"
        style="width: 100%"
      >
        <el-option
          v-for="sn in safeSubnets"
          :key="sn.subnet_id"
          :label="`${sn?.name || sn?.subnet_id} (${sn?.zone})`"
          :value="sn.subnet_id"
        />
      </el-select>
    </el-form-item>

    <!-- 安全组 -->
    <el-form-item label="安全组" prop="security_group_ids">
      <el-select
        v-model="form.security_group_ids"
        placeholder="请选择安全组"
        filterable
        multiple
        :loading="subnetLoading"
        style="width: 100%"
      >
        <el-option
          v-for="sg in safeSecurityGroups"
          :key="sg.security_group_id"
          :label="sg?.name || sg?.security_group_id"
          :value="sg.security_group_id"
        />
      </el-select>
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { listSecurityGroupAssetsApi, listVPCAssetsApi, listVSwitchAssetsApi } from '@/api/asset'
import {
  listImagesApi,
  listInstanceTypesApi,
  listRegionsApi
} from '@/api/template'
import type {
  ImageInfo,
  InstanceTypeInfo,
  SecurityGroupInfo,
  SubnetInfo,
  VPCInfo
} from '@/api/types/template'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

interface CascadeForm {
  cloud_account_id: number | undefined
  provider: string
  region: string
  zone: string
  instance_type: string
  image_id: string
  vpc_id: string
  subnet_id: string
  security_group_ids: string[]
}

interface AccountOption {
  id: number
  name: string
  provider: string
  regions: string[]
}

interface RegionOption {
  id: string
  local_name: string
}

const props = defineProps<{
  modelValue: CascadeForm
  accounts: AccountOption[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: CascadeForm): void
}>()

const form = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

// Loading states
const regionLoading = ref(false)
const specLoading = ref(false)
const subnetLoading = ref(false)

// Options data
const regionOptions = ref<RegionOption[]>([])
const instanceTypes = ref<InstanceTypeInfo[]>([])
const images = ref<ImageInfo[]>([])
const vpcs = ref<VPCInfo[]>([])
const subnets = ref<SubnetInfo[]>([])
const securityGroups = ref<SecurityGroupInfo[]>([])

// Safe computed arrays with null filtering
const safeAccountOptions = computed(() =>
  (props.accounts || []).filter(item => item != null)
)
const safeRegionOptions = computed(() =>
  (regionOptions.value || []).filter(item => item != null)
)
const safeInstanceTypes = computed(() =>
  (instanceTypes.value || []).filter(item => item != null)
)
const safeImages = computed(() =>
  (images.value || []).filter(item => item != null)
)
const safeVPCs = computed(() =>
  (vpcs.value || []).filter(item => item != null)
)
const safeSubnets = computed(() =>
  (subnets.value || []).filter(item => item != null)
)
const safeSecurityGroups = computed(() =>
  (securityGroups.value || []).filter(item => item != null)
)

// Handlers
async function handleAccountChange(accountId: number) {
  // Reset dependent fields
  form.value = {
    ...form.value,
    cloud_account_id: accountId,
    region: '',
    zone: '',
    instance_type: '',
    image_id: '',
    vpc_id: '',
    subnet_id: '',
    security_group_ids: []
  }

  // Find account and set provider
  const account = safeAccountOptions.value.find(a => a?.id === accountId)
  if (account) {
    form.value = { ...form.value, provider: account.provider }
  }

  // Clear downstream data
  instanceTypes.value = []
  images.value = []
  vpcs.value = []
  subnets.value = []
  securityGroups.value = []

  // Fetch regions from backend API
  if (!accountId) return
  regionLoading.value = true

  // First, set regions from account data as immediate fallback
  const fallbackRegions = buildRegionFallback(account)
  if (fallbackRegions.length > 0) {
    regionOptions.value = fallbackRegions
  }

  // Then try to fetch full region list from backend API (enhances the dropdown)
  try {
    const res = await listRegionsApi(accountId)
    const data = res?.data || []
    const regionList = (Array.isArray(data) ? data : [])
      .filter(r => r != null)
      .map(r => ({ id: r?.id || '', local_name: r?.local_name || r?.name || r?.id || '' }))
    if (regionList.length > 0) {
      regionOptions.value = regionList
    }
  } catch (err) {
    console.warn('[CascadeSelectors] listRegionsApi failed, using account regions fallback:', err)
    // fallbackRegions already set above
  } finally {
    regionLoading.value = false
  }
}

function buildRegionFallback(account: AccountOption | undefined): RegionOption[] {
  if (!account) return []
  const regions = account.regions || []
  if (regions.length > 0) {
    return regions.filter(r => r != null).map(r => ({ id: r, local_name: r }))
  }
  return []
}

async function handleRegionChange(region: string) {
  form.value = {
    ...form.value,
    region,
    instance_type: '',
    image_id: '',
    vpc_id: '',
    subnet_id: '',
    security_group_ids: []
  }
  subnets.value = []
  securityGroups.value = []

  if (!form.value.cloud_account_id || !region) return

  specLoading.value = true
  try {
    const [typesRes, imagesRes, vpcsRes] = await Promise.allSettled([
      listInstanceTypesApi(form.value.cloud_account_id, region),
      listImagesApi(form.value.cloud_account_id, region),
      listVPCAssetsApi({ account_id: form.value.cloud_account_id, region, limit: 200 })
    ])
    if (typesRes.status === 'fulfilled') {
      instanceTypes.value = typesRes.value?.data || []
    }
    if (imagesRes.status === 'fulfilled') {
      images.value = imagesRes.value?.data || []
    }
    if (vpcsRes.status === 'fulfilled') {
      const vpcItems = vpcsRes.value?.data?.items || vpcsRes.value?.data || []
      vpcs.value = (Array.isArray(vpcItems) ? vpcItems : []).filter((v: any) => v != null).map((v: any) => ({
        vpc_id: v?.asset_id || v?.attributes?.vpc_id || '',
        vpc_name: v?.asset_name || v?.attributes?.vpc_name || '',
        cidr_block: v?.attributes?.cidr_block || '',
        status: v?.attributes?.status || 'Available'
      }))
    }
    console.log('[CascadeSelectors] Loaded resources:', {
      instanceTypes: instanceTypes.value.length,
      images: images.value.length,
      vpcs: vpcs.value.length
    })
  } catch (err) {
    console.error('[CascadeSelectors] Failed to load cloud resources:', err)
    ElMessage.error('加载云资源失败，请重试')
    instanceTypes.value = []
    images.value = []
    vpcs.value = []
  } finally {
    specLoading.value = false
  }
}

async function handleVPCChange(vpcId: string) {
  form.value = {
    ...form.value,
    vpc_id: vpcId,
    subnet_id: '',
    security_group_ids: []
  }

  if (!form.value.cloud_account_id || !form.value.region || !vpcId) return

  subnetLoading.value = true
  try {
    const [subnetsRes, sgRes] = await Promise.allSettled([
      listVSwitchAssetsApi({ account_id: form.value.cloud_account_id, region: form.value.region, vpc_id: vpcId, limit: 200 }),
      listSecurityGroupAssetsApi({ account_id: form.value.cloud_account_id, region: form.value.region, vpc_id: vpcId, limit: 200 })
    ])
    if (subnetsRes.status === 'fulfilled') {
      const snItems = subnetsRes.value?.data?.items || subnetsRes.value?.data || []
      subnets.value = (Array.isArray(snItems) ? snItems : []).filter((s: any) => s != null).map((s: any) => ({
        subnet_id: s?.asset_id || s?.attributes?.vswitch_id || s?.attributes?.subnet_id || '',
        name: s?.asset_name || s?.attributes?.vswitch_name || s?.attributes?.subnet_name || '',
        cidr_block: s?.attributes?.cidr_block || '',
        zone: s?.attributes?.zone || s?.attributes?.zone_id || '',
        vpc_id: s?.attributes?.vpc_id || ''
      }))
    }
    if (sgRes.status === 'fulfilled') {
      const sgItems = sgRes.value?.data?.items || sgRes.value?.data || []
      securityGroups.value = (Array.isArray(sgItems) ? sgItems : []).filter((s: any) => s != null).map((s: any) => ({
        security_group_id: s?.asset_id || s?.attributes?.security_group_id || '',
        name: s?.asset_name || s?.attributes?.security_group_name || '',
        description: s?.attributes?.description || '',
        vpc_id: s?.attributes?.vpc_id || ''
      }))
    }
  } catch (err) {
    ElMessage.error('加载子网和安全组失败，请重试')
    subnets.value = []
    securityGroups.value = []
  } finally {
    subnetLoading.value = false
  }
}
</script>

<style scoped>
.cascade-selectors {
  width: 100%;
}
</style>
