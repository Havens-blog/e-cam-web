<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', val: boolean): void }>()
const router = useRouter()

interface FavItem { key: string; title: string; desc: string; path: string }
const SK = 'cam-platform-nav-favorites'
const defFavs: FavItem[] = [
  { key: 'assets-vm', title: '虚拟机', desc: 'ECS / EC2 / CVM', path: '/compute/ecs' },
  { key: 'assets-rds', title: 'RDS 云数据库', desc: '关系型数据库', path: '/databases/rds' },
  { key: 'fin-cost', title: '成本概览', desc: 'FinOps', path: '/finops/cost' },
  { key: 'alert-events', title: '告警事件', desc: '告警中心', path: '/alert/events' },
  { key: 'accounts', title: '云账号管理', desc: '多云账号接入', path: '/accounts' },
]
const loadF = (): FavItem[] => { try { const s = localStorage.getItem(SK); if (s) return JSON.parse(s) } catch { /* */ } return [...defFavs] }
const saveF = (v: FavItem[]) => localStorage.setItem(SK, JSON.stringify(v))
const favs = ref<FavItem[]>(loadF())
const isF = (k: string) => favs.value.some(f => f.key === k)
const togF = (k: string, t: string, d: string, p: string) => {
  const i = favs.value.findIndex(f => f.key === k)
  if (i > -1) favs.value.splice(i, 1); else favs.value.push({ key: k, title: t, desc: d, path: p })
  saveF(favs.value)
}
const rmF = (k: string) => { favs.value = favs.value.filter(f => f.key !== k); saveF(favs.value) }
const close = () => emit('update:visible', false)
const go = (p: string) => { router.push(p); close() }

// 彩色图标映射 - 使用函数避免 undefined 类型问题
const icMap: Record<string, string> = {
  dashboard: 'caise-public_cloud',
  'assets-vm': 'caise-computer', 'assets-tpl': 'caise-system', 'assets-disk': 'caise-disk_array',
  'assets-snap': 'caise-data_storage', 'assets-sg': 'caise-network_devices', 'assets-img': 'caise-system',
  'assets-nas': 'caise-storage_device', 'assets-oss': 'caise-storage_pool',
  'assets-vpc': 'caise-VPC', 'assets-eip': 'caise-ip_address', 'assets-vsw': 'caise-distributed_switch',
  'assets-lb': 'caise-load_balancing', 'assets-cdn': 'caise-CDN', 'assets-waf': 'caise-network',
  'assets-dns': 'caise-network_devices',
  'assets-rds': 'caise-database', 'assets-redis': 'caise-database', 'assets-mongo': 'caise-database',
  'assets-kafka': 'caise-kafka', 'assets-es': 'caise-middleware',
  'svc-main': 'caise-business', 'svc-env': 'caise-resource_pool', 'svc-rules': 'caise-standard_switch',
  tasks: 'caise-host_cluster', tags: 'caise-knowledge',
  'fin-cost': 'caise-data_center2', 'fin-alloc': 'caise-business', 'fin-budget': 'caise-folder',
  'fin-anomaly': 'caise-hardware', 'fin-collect': 'caise-data_center',
  'alert-ev': 'caise-hardware', 'alert-rules': 'caise-rack', 'alert-ch': 'caise-message_queue',
  'cmdb-mod': 'caise-resource_pool', 'cmdb-inst': 'caise-computer', 'cmdb-rel': 'caise-network', 'cmdb-topo': 'caise-VPC',
  'audit-log': 'caise-folder', 'audit-chg': 'caise-storage_cluster',
  accounts: 'caise-public_cloud', dict: 'caise-knowledge',
  users: 'caise-pc', groups: 'caise-host_cluster', tpls: 'caise-data_storage', tenants: 'caise-data_center2',
}
const ic = (k: string): string => icMap[k] ?? 'caise-public_cloud'
</script>

<template>
  <Teleport to="body">
    <Transition name="pnav-fade"><div v-if="visible" class="pnav-overlay" @click="close"></div></Transition>
    <Transition name="pnav-slide">
      <div v-if="visible" class="pnav-panel">
        <div class="pnav-inner">
          <!-- 收藏 -->
          <div class="pnav-fav">
            <div class="pnav-fav-hd"><el-icon :size="14" color="#fbbf24"><StarFilled /></el-icon> 我的收藏</div>
            <div v-for="f in favs" :key="f.key" class="pnav-fi" @click="go(f.path)">
              <IconFont :type="ic(f.key)" :size="18" class="pnav-fi-icon" />
              <div class="pnav-fi-info"><div class="pnav-fi-name">{{ f.title }}</div><div class="pnav-fi-desc">{{ f.desc }}</div></div>
              <span class="pnav-fi-rm" @click.stop="rmF(f.key)">✕</span>
            </div>
            <div v-if="!favs.length" class="pnav-fi-empty">点击右侧 ☆ 收藏</div>
          </div>
          <!-- 资源·主机 -->
          <div class="pnav-col">
            <div class="pnav-hd"><span class="pnav-dot" style="background:#34d399"></span>资源 · 主机</div>
            <div class="pnav-it" @click="go('/compute/ecs')"><IconFont :type="ic('assets-vm')" :size="18" /><span>虚拟机</span><i :class="{on:isF('assets-vm')}" @click.stop="togF('assets-vm','虚拟机','主机','/compute/ecs')">{{ isF('assets-vm') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/compute/template')"><IconFont :type="ic('assets-tpl')" :size="18" /><span>主机模板</span><i :class="{on:isF('assets-tpl')}" @click.stop="togF('assets-tpl','主机模板','主机','/compute/template')">{{ isF('assets-tpl') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/compute/disk')"><IconFont :type="ic('assets-disk')" :size="18" /><span>云盘</span><i :class="{on:isF('assets-disk')}" @click.stop="togF('assets-disk','云盘','主机','/compute/disk')">{{ isF('assets-disk') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/compute/snapshot')"><IconFont :type="ic('assets-snap')" :size="18" /><span>快照</span><i :class="{on:isF('assets-snap')}" @click.stop="togF('assets-snap','快照','主机','/compute/snapshot')">{{ isF('assets-snap') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/compute/security-group')"><IconFont :type="ic('assets-sg')" :size="18" /><span>安全组</span><i :class="{on:isF('assets-sg')}" @click.stop="togF('assets-sg','安全组','主机','/compute/security-group')">{{ isF('assets-sg') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/compute/image')"><IconFont :type="ic('assets-img')" :size="18" /><span>镜像管理</span><i :class="{on:isF('assets-img')}" @click.stop="togF('assets-img','镜像管理','主机','/compute/image')">{{ isF('assets-img') ? '★' : '☆' }}</i></div>
            <div class="pnav-sub">存储</div>
            <div class="pnav-it" @click="go('/storage/nas')"><IconFont :type="ic('assets-nas')" :size="18" /><span>文件存储 NAS</span><i :class="{on:isF('assets-nas')}" @click.stop="togF('assets-nas','文件存储 NAS','存储','/storage/nas')">{{ isF('assets-nas') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/storage/oss')"><IconFont :type="ic('assets-oss')" :size="18" /><span>对象存储 OSS</span><i :class="{on:isF('assets-oss')}" @click.stop="togF('assets-oss','对象存储 OSS','存储','/storage/oss')">{{ isF('assets-oss') ? '★' : '☆' }}</i></div>
          </div>
          <!-- 资源·网络 -->
          <div class="pnav-col">
            <div class="pnav-hd"><span class="pnav-dot" style="background:#34d399"></span>资源 · 网络</div>
            <div class="pnav-it" @click="go('/network/vpc')"><IconFont :type="ic('assets-vpc')" :size="18" /><span>VPC</span><i :class="{on:isF('assets-vpc')}" @click.stop="togF('assets-vpc','VPC','网络','/network/vpc')">{{ isF('assets-vpc') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/network/eip')"><IconFont :type="ic('assets-eip')" :size="18" /><span>弹性公网IP</span><i :class="{on:isF('assets-eip')}" @click.stop="togF('assets-eip','弹性公网IP','网络','/network/eip')">{{ isF('assets-eip') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/network/vswitch')"><IconFont :type="ic('assets-vsw')" :size="18" /><span>交换机</span><i :class="{on:isF('assets-vsw')}" @click.stop="togF('assets-vsw','交换机','网络','/network/vswitch')">{{ isF('assets-vsw') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/network/lb')"><IconFont :type="ic('assets-lb')" :size="18" /><span>负载均衡</span><i :class="{on:isF('assets-lb')}" @click.stop="togF('assets-lb','负载均衡','网络','/network/lb')">{{ isF('assets-lb') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/network/cdn')"><IconFont :type="ic('assets-cdn')" :size="18" /><span>CDN 加速</span><i :class="{on:isF('assets-cdn')}" @click.stop="togF('assets-cdn','CDN 加速','网络','/network/cdn')">{{ isF('assets-cdn') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/network/waf')"><IconFont :type="ic('assets-waf')" :size="18" /><span>WAF 防火墙</span><i :class="{on:isF('assets-waf')}" @click.stop="togF('assets-waf','WAF 防火墙','网络','/network/waf')">{{ isF('assets-waf') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/network/eni')"><IconFont :type="ic('assets-eni')" :size="18" /><span>弹性网卡</span><i :class="{on:isF('assets-eni')}" @click.stop="togF('assets-eni','弹性网卡','网络','/network/eni')">{{ isF('assets-eni') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/network/dns')"><IconFont :type="ic('assets-dns')" :size="18" /><span>DNS 管理</span><i :class="{on:isF('assets-dns')}" @click.stop="togF('assets-dns','DNS 管理','网络','/network/dns')">{{ isF('assets-dns') ? '★' : '☆' }}</i></div>
            <div class="pnav-sub">数据库</div>
            <div class="pnav-it" @click="go('/databases/rds')"><IconFont :type="ic('assets-rds')" :size="18" /><span>RDS 云数据库</span><i :class="{on:isF('assets-rds')}" @click.stop="togF('assets-rds','RDS 云数据库','数据库','/databases/rds')">{{ isF('assets-rds') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/databases/redis')"><IconFont :type="ic('assets-redis')" :size="18" /><span>Redis</span><i :class="{on:isF('assets-redis')}" @click.stop="togF('assets-redis','Redis','数据库','/databases/redis')">{{ isF('assets-redis') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/databases/mongodb')"><IconFont :type="ic('assets-mongo')" :size="18" /><span>MongoDB</span><i :class="{on:isF('assets-mongo')}" @click.stop="togF('assets-mongo','MongoDB','数据库','/databases/mongodb')">{{ isF('assets-mongo') ? '★' : '☆' }}</i></div>
            <div class="pnav-sub">中间件</div>
            <div class="pnav-it" @click="go('/middleware/kafka')"><IconFont :type="ic('assets-kafka')" :size="18" /><span>Kafka</span><i :class="{on:isF('assets-kafka')}" @click.stop="togF('assets-kafka','Kafka','中间件','/middleware/kafka')">{{ isF('assets-kafka') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/middleware/elasticsearch')"><IconFont :type="ic('assets-es')" :size="18" /><span>Elasticsearch</span><i :class="{on:isF('assets-es')}" @click.stop="togF('assets-es','Elasticsearch','中间件','/middleware/elasticsearch')">{{ isF('assets-es') ? '★' : '☆' }}</i></div>
          </div>
          <!-- 资源·其他 -->
          <div class="pnav-col pnav-col-sm">
            <div class="pnav-hd"><span class="pnav-dot" style="background:#34d399"></span>资源 · 其他</div>
            <div class="pnav-it" @click="go('/service-tree')"><IconFont :type="ic('svc-main')" :size="18" /><span>服务树总览</span><i :class="{on:isF('svc-main')}" @click.stop="togF('svc-main','服务树总览','服务树','/service-tree')">{{ isF('svc-main') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/service-tree/environments')"><IconFont :type="ic('svc-env')" :size="18" /><span>环境管理</span><i :class="{on:isF('svc-env')}" @click.stop="togF('svc-env','环境管理','服务树','/service-tree/environments')">{{ isF('svc-env') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/service-tree/rules')"><IconFont :type="ic('svc-rules')" :size="18" /><span>绑定规则</span><i :class="{on:isF('svc-rules')}" @click.stop="togF('svc-rules','绑定规则','服务树','/service-tree/rules')">{{ isF('svc-rules') ? '★' : '☆' }}</i></div>
            <div style="height:6px"></div>
            <div class="pnav-it" @click="go('/tasks')"><IconFont :type="ic('tasks')" :size="18" /><span>任务管理</span><i :class="{on:isF('tasks')}" @click.stop="togF('tasks','任务管理','资源','/tasks')">{{ isF('tasks') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/resource/tags')"><IconFont :type="ic('tags')" :size="18" /><span>标签管理</span><i :class="{on:isF('tags')}" @click.stop="togF('tags','标签管理','资源','/resource/tags')">{{ isF('tags') ? '★' : '☆' }}</i></div>
          </div>
          <!-- FinOps -->
          <div class="pnav-col pnav-col-sm">
            <div class="pnav-hd"><span class="pnav-dot" style="background:#fbbf24"></span>FINOPS</div>
            <div class="pnav-it" @click="go('/finops/cost')"><IconFont :type="ic('fin-cost')" :size="18" /><span>成本概览</span><i :class="{on:isF('fin-cost')}" @click.stop="togF('fin-cost','成本概览','FinOps','/finops/cost')">{{ isF('fin-cost') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/finops/allocation')"><IconFont :type="ic('fin-alloc')" :size="18" /><span>成本分摊</span><i :class="{on:isF('fin-alloc')}" @click.stop="togF('fin-alloc','成本分摊','FinOps','/finops/allocation')">{{ isF('fin-alloc') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/finops/budget')"><IconFont :type="ic('fin-budget')" :size="18" /><span>预算管理</span><i :class="{on:isF('fin-budget')}" @click.stop="togF('fin-budget','预算管理','FinOps','/finops/budget')">{{ isF('fin-budget') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/finops/anomaly')"><IconFont :type="ic('fin-anomaly')" :size="18" /><span>异常与优化</span><i :class="{on:isF('fin-anomaly')}" @click.stop="togF('fin-anomaly','异常与优化','FinOps','/finops/anomaly')">{{ isF('fin-anomaly') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/finops/collect')"><IconFont :type="ic('fin-collect')" :size="18" /><span>采集管理</span><i :class="{on:isF('fin-collect')}" @click.stop="togF('fin-collect','采集管理','FinOps','/finops/collect')">{{ isF('fin-collect') ? '★' : '☆' }}</i></div>
          </div>
          <!-- 平台管理 -->
          <div class="pnav-col">
            <div class="pnav-hd"><span class="pnav-dot" style="background:#a78bfa"></span>平台管理</div>
            <div class="pnav-sub" style="margin-top:0">告警中心</div>
            <div class="pnav-it" @click="go('/alert/events')"><IconFont :type="ic('alert-ev')" :size="18" /><span>告警事件</span><i :class="{on:isF('alert-ev')}" @click.stop="togF('alert-ev','告警事件','告警中心','/alert/events')">{{ isF('alert-ev') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/alert/rules')"><IconFont :type="ic('alert-rules')" :size="18" /><span>告警规则</span><i :class="{on:isF('alert-rules')}" @click.stop="togF('alert-rules','告警规则','告警中心','/alert/rules')">{{ isF('alert-rules') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/alert/channels')"><IconFont :type="ic('alert-ch')" :size="18" /><span>通知渠道</span><i :class="{on:isF('alert-ch')}" @click.stop="togF('alert-ch','通知渠道','告警中心','/alert/channels')">{{ isF('alert-ch') ? '★' : '☆' }}</i></div>
            <div class="pnav-sub">CMDB</div>
            <div class="pnav-it" @click="go('/cmdb/models')"><IconFont :type="ic('cmdb-mod')" :size="18" /><span>资源模型</span><i :class="{on:isF('cmdb-mod')}" @click.stop="togF('cmdb-mod','资源模型','CMDB','/cmdb/models')">{{ isF('cmdb-mod') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/cmdb/instances')"><IconFont :type="ic('cmdb-inst')" :size="18" /><span>资源实例</span><i :class="{on:isF('cmdb-inst')}" @click.stop="togF('cmdb-inst','资源实例','CMDB','/cmdb/instances')">{{ isF('cmdb-inst') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/cmdb/relations')"><IconFont :type="ic('cmdb-rel')" :size="18" /><span>模型关系</span><i :class="{on:isF('cmdb-rel')}" @click.stop="togF('cmdb-rel','模型关系','CMDB','/cmdb/relations')">{{ isF('cmdb-rel') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/cmdb/topology')"><IconFont :type="ic('cmdb-topo')" :size="18" /><span>拓扑视图</span><i :class="{on:isF('cmdb-topo')}" @click.stop="togF('cmdb-topo','拓扑视图','CMDB','/cmdb/topology')">{{ isF('cmdb-topo') ? '★' : '☆' }}</i></div>
            <div class="pnav-sub">系统</div>
            <div class="pnav-it" @click="go('/audit/logs')"><IconFont :type="ic('audit-log')" :size="18" /><span>操作审计</span><i :class="{on:isF('audit-log')}" @click.stop="togF('audit-log','操作审计','系统','/audit/logs')">{{ isF('audit-log') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/audit/changes')"><IconFont :type="ic('audit-chg')" :size="18" /><span>变更历史</span><i :class="{on:isF('audit-chg')}" @click.stop="togF('audit-chg','变更历史','系统','/audit/changes')">{{ isF('audit-chg') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/accounts')"><IconFont :type="ic('accounts')" :size="18" /><span>云账号管理</span><i :class="{on:isF('accounts')}" @click.stop="togF('accounts','云账号管理','系统','/accounts')">{{ isF('accounts') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/system/dictionary')"><IconFont :type="ic('dict')" :size="18" /><span>数据字典</span><i :class="{on:isF('dict')}" @click.stop="togF('dict','数据字典','系统','/system/dictionary')">{{ isF('dict') ? '★' : '☆' }}</i></div>
            <div class="pnav-sub">用户与权限</div>
            <div class="pnav-it" @click="go('/iam/users')"><IconFont :type="ic('users')" :size="18" /><span>用户管理</span><i :class="{on:isF('users')}" @click.stop="togF('users','用户管理','用户与权限','/iam/users')">{{ isF('users') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/iam/groups')"><IconFont :type="ic('groups')" :size="18" /><span>用户组</span><i :class="{on:isF('groups')}" @click.stop="togF('groups','用户组','用户与权限','/iam/groups')">{{ isF('groups') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/iam/templates')"><IconFont :type="ic('tpls')" :size="18" /><span>策略模板</span><i :class="{on:isF('tpls')}" @click.stop="togF('tpls','策略模板','用户与权限','/iam/templates')">{{ isF('tpls') ? '★' : '☆' }}</i></div>
            <div class="pnav-it" @click="go('/iam/tenants')"><IconFont :type="ic('tenants')" :size="18" /><span>租户管理</span><i :class="{on:isF('tenants')}" @click.stop="togF('tenants','租户管理','用户与权限','/iam/tenants')">{{ isF('tenants') ? '★' : '☆' }}</i></div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss">
/* 遮罩 - 只覆盖面板下方区域 */
.pnav-overlay { position: fixed; top: 56px; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.35); z-index: 9990; }

/* 面板 - 居中显示，不铺满整个宽度 */
.pnav-panel {
  position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
  width: 1100px; max-width: calc(100vw - 40px);
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 0 0 12px 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,.3);
  z-index: 9991;
}
.pnav-inner { display: flex; padding: 18px 24px; gap: 0; width: 100%; }

/* 收藏 */
.pnav-fav { width: 170px; flex-shrink: 0; border-right: 1px solid var(--border-subtle); padding-right: 16px; margin-right: 16px; }
.pnav-fav-hd { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 10px; display: flex; align-items: center; gap: 5px; }
.pnav-fi { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 5px; cursor: pointer; transition: background .12s;
  &:hover { background: var(--bg-hover); .pnav-fi-rm { opacity: .5; } } }
.pnav-fi-icon { flex-shrink: 0; }
.pnav-fi-info { flex: 1; min-width: 0; }
.pnav-fi-name { font-size: 12.5px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pnav-fi-desc { font-size: 10px; color: var(--text-muted); }
.pnav-fi-rm { opacity: 0; color: var(--text-muted); font-size: 9px; cursor: pointer; flex-shrink: 0; transition: all .12s; font-style: normal;
  &:hover { opacity: 1 !important; color: var(--accent-red); } }
.pnav-fi-empty { padding: 10px 4px; font-size: 11px; color: var(--text-muted); text-align: center; }

/* 列 */
.pnav-col { padding: 0 14px; border-right: 1px solid var(--border-subtle); flex: 1; min-width: 0;
  &:last-child { border-right: none; }
  &.pnav-col-sm { flex: 0.8; } }
.pnav-hd { font-size: 13px; font-weight: 700; color: var(--text-secondary); margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 6px; letter-spacing: .3px; }
.pnav-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.pnav-sub { font-size: 11px; color: var(--text-muted); font-weight: 600; margin: 6px 0 2px 4px; letter-spacing: .3px; }

/* 导航项 */
.pnav-it {
  display: flex; align-items: center; gap: 7px;
  padding: 4px 4px; border-radius: 5px; cursor: pointer;
  transition: background .12s; font-size: 12px; color: var(--text-primary); font-weight: 400;
  &:hover { background: var(--bg-hover); & > i { opacity: .5; } }
  & > .icon-svg, & > .iconfont { flex-shrink: 0; }
  & > span { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  & > i {
    opacity: 0; color: var(--text-muted); font-size: 11px; cursor: pointer; flex-shrink: 0;
    transition: all .12s; font-style: normal;
    &:hover { opacity: 1 !important; color: #fbbf24; }
    &.on { opacity: 1; color: #fbbf24; }
  }
}

/* 动画 */
.pnav-fade-enter-active, .pnav-fade-leave-active { transition: opacity .2s; }
.pnav-fade-enter-from, .pnav-fade-leave-to { opacity: 0; }
.pnav-slide-enter-active, .pnav-slide-leave-active { transition: all .25s ease; }
.pnav-slide-enter-from { opacity: 0; max-height: 0; overflow: hidden; }
.pnav-slide-leave-to { opacity: 0; max-height: 0; overflow: hidden; }
.pnav-slide-enter-to, .pnav-slide-leave-from { opacity: 1; max-height: 600px; }
</style>
