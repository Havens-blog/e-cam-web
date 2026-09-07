<template>
  <div class="cred-card" aria-labelledby="cred-card-title">
    <div class="card-head">
      <div>
        <h3 id="cred-card-title" class="card-title">集群凭证</h3>
        <p class="card-desc">ACK 集群 kubeconfig（信封加密落库）；登记后 AlbConfig/Ingress 等内置 CRD 自动随扫描生效</p>
      </div>
      <div class="head-actions">
        <el-button size="small" @click="openFetch">从云端拉取</el-button>
        <el-button size="small" @click="openManual">手动登记</el-button>
      </div>
    </div>

    <table class="cred-table" aria-label="已登记集群">
      <thead>
        <tr>
          <th scope="col">集群名</th>
          <th scope="col">API Endpoint</th>
          <th scope="col">登记时间</th>
          <th scope="col" class="op-col"><span class="sr-only">操作</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in creds" :key="c.clusterName">
          <td class="cell-mono">{{ c.clusterName }}</td>
          <td class="cell-mono endpoint">{{ c.apiEndpoint || '—' }}</td>
          <td>{{ c.createdAt || '—' }}</td>
          <td class="op-col">
            <el-popconfirm title="删除该集群凭证？扫描将不再覆盖此集群。" @confirm="onDelete(c.clusterName)">
              <template #reference>
                <el-button size="small" text type="danger" :aria-label="`删除 ${c.clusterName}`">删除</el-button>
              </template>
            </el-popconfirm>
          </td>
        </tr>
        <tr v-if="!creds.length">
          <td colspan="4" class="empty-row">尚未登记集群凭证</td>
        </tr>
      </tbody>
    </table>

    <!-- 从云端拉取：选账号 → 列 ACK 集群 → 勾选拉取登记 -->
    <el-dialog v-model="fetchVisible" title="从云端拉取集群凭证" width="640px" align-center class="cert-modal">
      <div class="fetch-step">
        <label class="field-label" for="fetch-account-select">阿里云账号</label>
        <el-select
          id="fetch-account-select"
          v-model="fetchAccount"
          class="account-select"
          placeholder="选择已登记的阿里云账号"
          :loading="accountsLoading"
          data-testid="fetch-account-select"
        >
          <el-option v-for="a in aliyunAccounts" :key="a.name" :label="a.name" :value="a.name" />
        </el-select>
        <el-button class="list-btn" size="small" :disabled="!fetchAccount" :loading="clustersLoading" @click="loadClusters">
          列出集群
        </el-button>
      </div>

      <table v-if="clusters.length" class="cred-table cluster-table" aria-label="ACK 集群清单">
        <thead>
          <tr>
            <th scope="col" class="check-col"><input type="checkbox" :checked="allChecked" aria-label="全选集群" @change="toggleAll" /></th>
            <th scope="col">集群名</th>
            <th scope="col">集群 ID</th>
            <th scope="col">地域</th>
            <th scope="col">状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cl in clusters" :key="cl.clusterId">
            <td class="check-col"><input v-model="checked" type="checkbox" :value="cl.clusterId" :aria-label="`选择 ${cl.name}`" /></td>
            <td>{{ cl.name }}</td>
            <td class="cell-mono">{{ cl.clusterId }}</td>
            <td>{{ cl.regionId }}</td>
            <td><span class="state-tag" :class="{ degraded: cl.state !== 'running' }">{{ cl.state }}</span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="clustersLoading" class="hint" role="status">正在列出集群…</div>

      <div class="fetch-option">
        <label class="opt-label">
          <input v-model="privateIp" type="checkbox" />
          拉取内网 endpoint（e-cam 与集群同 VPC/专线时；否则需集群已开启公网 APIServer）
        </label>
      </div>

      <div v-if="fetchResults.length" class="fetch-results" data-testid="fetch-results">
        <div v-for="r in fetchResults" :key="r.clusterId" class="fetch-result-row" :class="`tone-${r.status}`">
          <span class="cell-mono">{{ r.clusterId }}</span>
          <span>{{ fetchStatusText(r.status) }}</span>
          <span v-if="r.reason" class="result-reason">{{ r.reason }}</span>
        </div>
      </div>

      <template #footer>
        <el-button @click="fetchVisible = false">关闭</el-button>
        <el-button
          type="primary"
          :loading="fetching"
          :disabled="!checked.length"
          data-testid="fetch-submit"
          @click="onFetch"
        >
          拉取并登记（{{ checked.length }}）
        </el-button>
      </template>
    </el-dialog>

    <!-- 手动登记：粘贴 kubeconfig -->
    <el-dialog v-model="manualVisible" title="手动登记集群凭证" width="560px" align-center class="cert-modal">
      <div class="manual-form">
        <label class="field-label" for="manual-cluster-name">集群名（唯一）</label>
        <el-input id="manual-cluster-name" v-model="manualName" placeholder="如 cluster-a" />
        <label class="field-label" for="manual-kubeconfig">kubeconfig（YAML 明文，登记后信封加密，不再展示）</label>
        <el-input
          id="manual-kubeconfig"
          v-model="manualKubeconfig"
          type="textarea"
          :rows="8"
          placeholder="粘贴 kubeconfig 内容"
          data-testid="manual-kubeconfig"
        />
      </div>
      <template #footer>
        <el-button @click="manualVisible = false">取消</el-button>
        <el-button type="primary" :loading="manualSaving" :disabled="!manualName.trim() || !manualKubeconfig.trim()" @click="onManualAdd">
          登记
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 集群凭证卡（cert-alb-ingress-managed 第一层）：已登记集群列表/删除 +
 * 手动登记 + 从云端拉取（选阿里云账号 → 列 ACK 集群 → 勾选批量拉取，
 * 单集群失败不中断批次逐条展示结果）。kubeconfig 明文只在登记流程流经，
 * 列表视图永不回显。
 */
import { listCloudAccountsApi } from '@/api'
import type { CloudAccount } from '@/api/types/account'
import {
    addK8sCredentialApi,
    deleteK8sCredentialApi,
    fetchK8sCredentialsApi,
    listAliyunK8sClustersApi,
    listK8sCredentialsApi,
} from '@/api/cert'
import type { AliyunK8sCluster, K8sCredentialFetchResult, K8sCredentialItem } from '@/api/cert'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'

const emit = defineEmits<{ (e: 'changed'): void }>()

const creds = ref<K8sCredentialItem[]>([])
const loading = ref(false)

// ---- 云端拉取 ----
const fetchVisible = ref(false)
const aliyunAccounts = ref<CloudAccount[]>([])
const accountsLoading = ref(false)
const fetchAccount = ref('')
const clustersLoading = ref(false)
const clusters = ref<AliyunK8sCluster[]>([])
const checked = ref<string[]>([])
const privateIp = ref(false)
const fetching = ref(false)
const fetchResults = ref<K8sCredentialFetchResult[]>([])

// ---- 手动登记 ----
const manualVisible = ref(false)
const manualName = ref('')
const manualKubeconfig = ref('')
const manualSaving = ref(false)

const allChecked = ref(false)

function toggleAll() {
    if (allChecked.value) {
        checked.value = []
        allChecked.value = false
    } else {
        checked.value = clusters.value.map((c) => c.clusterId)
        allChecked.value = true
    }
}

async function load() {
    loading.value = true
    try {
        creds.value = await listK8sCredentialsApi()
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '集群凭证列表获取失败')
    } finally {
        loading.value = false
    }
}

function openFetch() {
    fetchVisible.value = true
    fetchResults.value = []
    clusters.value = []
    checked.value = []
    void loadAccounts()
}

async function loadAccounts() {
    accountsLoading.value = true
    try {
        const { data } = await listCloudAccountsApi({ provider: 'aliyun', status: 'active', page: 1, size: 100 })
        aliyunAccounts.value = (data?.accounts ?? []).filter((a) => a.provider === 'aliyun')
    } catch {
        ElMessage.error('云账号列表获取失败')
    } finally {
        accountsLoading.value = false
    }
}

async function loadClusters() {
    if (!fetchAccount.value) return
    clustersLoading.value = true
    clusters.value = []
    checked.value = []
    allChecked.value = false
    try {
        clusters.value = await listAliyunK8sClustersApi(fetchAccount.value)
        if (!clusters.value.length) ElMessage.info('该账号名下未发现 ACK 集群')
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '集群列表获取失败')
    } finally {
        clustersLoading.value = false
    }
}

async function onFetch() {
    if (fetching.value || !checked.value.length) return
    fetching.value = true
    try {
        fetchResults.value = await fetchK8sCredentialsApi({
            accountKey: fetchAccount.value,
            clusterIds: checked.value,
            privateIp: privateIp.value,
        })
        const ok = fetchResults.value.filter((r) => r.status === 'registered').length
        if (ok) ElMessage.success(`已登记 ${ok} 个集群`)
        await load()
        emit('changed')
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '拉取登记失败')
    } finally {
        fetching.value = false
    }
}

function openManual() {
    manualName.value = ''
    manualKubeconfig.value = ''
    manualVisible.value = true
}

async function onManualAdd() {
    if (manualSaving.value) return
    manualSaving.value = true
    try {
        await addK8sCredentialApi({ clusterName: manualName.value.trim(), kubeconfig: manualKubeconfig.value })
        ElMessage.success('集群已登记')
        manualVisible.value = false
        await load()
        emit('changed')
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '登记失败')
    } finally {
        manualSaving.value = false
    }
}

async function onDelete(name: string) {
    try {
        await deleteK8sCredentialApi(name)
        ElMessage.success('已删除')
        await load()
        emit('changed')
    } catch (err) {
        ElMessage.error(err instanceof Error ? err.message : '删除失败')
    }
}

function fetchStatusText(status: K8sCredentialFetchResult['status']): string {
    switch (status) {
        case 'registered':
            return '已登记'
        case 'duplicate':
            return '已存在（幂等跳过）'
        default:
            return '失败'
    }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.cred-card {
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 16px 24px;
  background: var(--glass-bg);
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.head-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.cred-table {
  width: 100%;
  margin-top: 12px;
  border-collapse: collapse;

  th {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border-base);
  }

  td {
    font-size: 13px;
    color: var(--text-primary);
    padding: 9px 10px;
    border-bottom: 1px solid var(--border-base);
  }

  tr:last-child td {
    border-bottom: none;
  }
}

.cell-mono {
  font-family: var(--cert-font-mono, monospace);
  font-size: 12px;
  word-break: break-all;
}

.endpoint {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.op-col {
  width: 70px;
  text-align: right;
}

.empty-row {
  text-align: center;
  color: var(--text-secondary);
  padding: 18px 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.fetch-step {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.field-label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin: 8px 0 4px;
}

.account-select {
  width: 260px;
}

.cluster-table {
  margin-bottom: 8px;
}

.check-col {
  width: 36px;
  text-align: center;
}

.state-tag {
  font-size: 12px;
  color: var(--text-secondary);

  &.degraded {
    color: #f5a623;
  }
}

.fetch-option {
  margin-top: 8px;
}

.opt-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.fetch-results {
  margin-top: 12px;
  border-top: 1px dashed var(--border-base);
  padding-top: 8px;
}

.fetch-result-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: 12px;
  padding: 3px 0;

  &.tone-registered { color: #10b981; }
  &.tone-duplicate { color: var(--text-secondary); }
  &.tone-failed { color: #ef4444; }
}

.result-reason {
  color: var(--text-secondary);
  word-break: break-all;
}

.hint {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 0;
}
</style>
