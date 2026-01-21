<template>
  <div v-if="showMonitor" class="error-monitor">
    <div class="monitor-header">
      <span class="title">错误监控</span>
      <div class="actions">
        <el-badge :value="errorCount" :hidden="errorCount === 0" type="danger">
          <el-button size="small" @click="toggleExpanded">
            {{ expanded ? '收起' : '展开' }}
          </el-button>
        </el-badge>
        <el-button size="small" @click="clearLogs">清空</el-button>
        <el-button size="small" @click="exportLogs">导出</el-button>
        <el-button size="small" @click="showMonitor = false">关闭</el-button>
      </div>
    </div>
    <div v-if="expanded" class="monitor-content">
      <el-tabs v-model="activeTab" type="card">
        <el-tab-pane label="错误日志" name="errors">
          <div class="log-list">
            <div
              v-for="(log, index) in errorLogs"
              :key="index"
              class="log-item"
              :class="`log-${log.level}`"
            >
              <div class="log-header">
                <span class="log-level">{{ log.level.toUpperCase() }}</span>
                <span class="log-time">{{ formatTime(log.timestamp) }}</span>
                <span v-if="log.context" class="log-context">[{{ log.context }}]</span>
              </div>
              <div class="log-message">{{ log.message }}</div>
              <div v-if="log.data" class="log-data">
                <pre>{{ JSON.stringify(log.data, null, 2) }}</pre>
              </div>
              <div v-if="log.stack" class="log-stack">
                <details>
                  <summary>堆栈信息</summary>
                  <pre>{{ log.stack }}</pre>
                </details>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="错误统计" name="stats">
          <div class="stats-content">
            <el-table :data="statsData" size="small">
              <el-table-column prop="type" label="错误类型" width="120" />
              <el-table-column prop="code" label="错误码" width="120" />
              <el-table-column prop="count" label="次数" width="80" />
              <el-table-column prop="percentage" label="占比" width="80" />
            </el-table>
          </div>
        </el-tab-pane>
        <el-tab-pane label="网络状态" name="network">
          <div class="network-info">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="连接状态">
                <el-tag :type="networkStatus.online ? 'success' : 'danger'">
                  {{ networkStatus.online ? '在线' : '离线' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="连接类型">
                {{ networkStatus.effectiveType || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="下行速度">
                {{ networkStatus.downlink ? `${networkStatus.downlink} Mbps` : '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="RTT">
                {{ networkStatus.rtt ? `${networkStatus.rtt} ms` : '未知' }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { errorStats } from '@/plugins/error-handler'
import { logger } from '@/utils/error-logger'
import { computed, onMounted, onUnmounted, ref } from 'vue'

// 只在开发环境显示
const showMonitor = ref(import.meta.env.DEV)
const expanded = ref(false)
const activeTab = ref('errors')

// 日志数据
const logs = ref<any[]>([])
const networkStatus = ref({
  online: navigator.onLine,
  effectiveType: '',
  downlink: 0,
  rtt: 0,
})

// 计算属性
const errorLogs = computed(() => {
  return logs.value.filter(log => log.level === 'error' || log.level === 'warn')
})

const errorCount = computed(() => errorLogs.value.length)

const statsData = computed(() => {
  const stats = errorStats.getStats()
  const total = Object.values(stats).reduce((sum: number, count) => sum + (count as number), 0)
  
  return Object.entries(stats).map(([key, count]) => {
    const [type, code] = key.split(':')
    return {
      type,
      code,
      count,
      percentage: total > 0 ? `${(((count as number) / total) * 100).toFixed(1)}%` : '0%',
    }
  })
})

// 方法
const toggleExpanded = () => {
  expanded.value = !expanded.value
}

const clearLogs = () => {
  logger.clearLogs()
  errorStats.clear()
  refreshLogs()
}

const exportLogs = () => {
  const data = logger.exportLogs()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `error-logs-${new Date().toISOString().slice(0, 19)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const formatTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleTimeString()
}

const refreshLogs = () => {
  logs.value = logger.getLogs()
}

const updateNetworkStatus = () => {
  networkStatus.value.online = navigator.onLine
  
  // 获取网络连接信息（如果支持）
  if ('connection' in navigator) {
    const connection = (navigator as any).connection
    networkStatus.value.effectiveType = connection.effectiveType || ''
    networkStatus.value.downlink = connection.downlink || 0
    networkStatus.value.rtt = connection.rtt || 0
  }
}

// 生命周期
let refreshTimer: number | null = null

onMounted(() => {
  refreshLogs()
  updateNetworkStatus()
  
  // 定期刷新日志
  refreshTimer = window.setInterval(refreshLogs, 2000)
  
  // 监听网络状态变化
  window.addEventListener('online', updateNetworkStatus)
  window.addEventListener('offline', updateNetworkStatus)
  
  // 监听网络连接变化（如果支持）
  if ('connection' in navigator) {
    (navigator as any).connection.addEventListener('change', updateNetworkStatus)
  }
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
  
  window.removeEventListener('online', updateNetworkStatus)
  window.removeEventListener('offline', updateNetworkStatus)
  
  if ('connection' in navigator) {
    (navigator as any).connection.removeEventListener('change', updateNetworkStatus)
  }
})
</script>

<style scoped lang="scss">
.error-monitor {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  max-height: 600px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 9999;
  font-size: 12px;
  transition: background-color 0.3s ease, border-color 0.3s ease;

  .monitor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-subtle);
    border-radius: 12px 12px 0 0;

    .title {
      font-weight: 600;
      color: var(--text-primary);
    }

    .actions {
      display: flex;
      gap: 4px;
    }
  }

  .monitor-content {
    max-height: 500px;
    overflow: auto;

    .log-list {
      padding: 8px;
      max-height: 400px;
      overflow-y: auto;

      .log-item {
        margin-bottom: 8px;
        padding: 8px;
        border-radius: 6px;
        border-left: 3px solid var(--border-base);
        background: var(--bg-elevated);

        &.log-error {
          background: rgba(239, 68, 68, 0.1);
          border-left-color: var(--accent-red);
        }

        &.log-warn {
          background: rgba(245, 158, 11, 0.1);
          border-left-color: var(--accent-yellow);
        }

        &.log-info {
          background: rgba(59, 130, 246, 0.1);
          border-left-color: var(--accent-blue);
        }

        .log-header {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
          font-size: 11px;

          .log-level {
            font-weight: 600;
            color: var(--text-secondary);
          }

          .log-time {
            color: var(--text-muted);
          }

          .log-context {
            color: var(--text-secondary);
            font-weight: 500;
          }
        }

        .log-message {
          font-weight: 500;
          margin-bottom: 4px;
          color: var(--text-primary);
        }

        .log-data,
        .log-stack {
          pre {
            margin: 0;
            padding: 4px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
            font-size: 10px;
            overflow-x: auto;
            color: var(--text-secondary);
          }
        }

        .log-stack {
          details {
            summary {
              cursor: pointer;
              font-size: 11px;
              color: var(--text-tertiary);
            }
          }
        }
      }
    }

    .stats-content {
      padding: 8px;
    }

    .network-info {
      padding: 8px;
    }
  }
}

@media (max-width: 768px) {
  .error-monitor {
    width: calc(100vw - 40px);
    right: 20px;
  }
}
</style>
