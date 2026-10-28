/**
 * 日志源清单：加载 / 按类型缓存 / 云·账号分组 / 可用云推导。
 *
 * 拆分来源：原 `src/views/logs/index.vue` 的「日志源」相关状态与逻辑。
 * 边界理由：本单元自带独立的远端数据（`getLogSourcesApi`）与缓存策略，对外只暴露
 * 「源列表 / 加载中 / 分组 / 可用云 / 禁投递源」与「加载、强制刷新」两类接口，
 * 与查询、筛选、渲染均无反向依赖，是页内耦合度最低的一块，宜优先外移。
 *
 * 依赖方向：本模块只读 `activeType`，会写 `selectedResources`（清理失效选择）与
 * `selectedClouds`（首次加载收敛默认云），均为显式传入的 ref，不做隐式全局状态。
 */
import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { getLogSourcesApi } from '@/api/logs'
import type { LogSource, LogType } from '@/api/types/logs'
import { ElMessage } from 'element-plus'
import { CLOUD_ORDER, groupRank } from './cloud-order'
import { cloudLabel } from './format'

export interface UseLogSourcesOptions {
    /** 当前日志类型（决定拉哪一类源，也是缓存键） */
    activeType: Ref<LogType>
    /** 已选云（用于本地过滤，不触发重拉） */
    selectedClouds: Ref<string[]>
    /** 已选日志源；源清单变化后需清理其中已失效的项 */
    selectedResources: Ref<string[]>
    /** 用户是否手动改过云选择（改过后不再自动收敛到默认云） */
    cloudsTouched: Ref<boolean>
    /** 首次加载时收敛到的默认云（只保留实际有源的） */
    defaultClouds: readonly string[]
}

export function useLogSources(opts: UseLogSourcesOptions) {
    const { activeType, selectedClouds, selectedResources, cloudsTouched, defaultClouds } = opts

    const sources = ref<LogSource[]>([])
    const sourcesLoading = ref(false)
    /**
     * 各类型日志源本地缓存：源清单（CDN/WAF 域名、S3 前缀、LTS 流）变动频率
     * 远低于请求频率，切 Tab 复用缓存立即渲染（零请求）；「刷新源列表」按钮
     * 强制重拉兜底。云选择过滤是本地 computed，不再触发重拉。
     */
    const sourcesCache = ref<Record<string, LogSource[]>>({})

    /** 按已选云过滤后的源（未选云 = 全部） */
    const filteredSources = computed(() =>
        selectedClouds.value.length
            ? sources.value.filter((s) => selectedClouds.value.includes(s.cloud))
            : sources.value,
    )

    /** 云·账号分组（供「日志源」下拉的 option-group 使用），组序按 CLOUD_ORDER */
    const sourceGroups = computed(() => {
        const map = new Map<string, LogSource[]>()
        for (const s of filteredSources.value) {
            const key = `${s.cloud}·${s.account_name}`
            if (!map.has(key)) map.set(key, [])
            map.get(key)!.push(s)
        }
        return Array.from(map.entries())
            .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
            .map(([key, list]) => ({ key, label: key, sources: list }))
    })

    /** 实际有源的云（云筛选下拉选项；顺序同 CLOUD_ORDER，未知云按 indexOf=-1 排前） */
    const availableClouds = computed(() => {
        const seen = new Map<string, string>()
        for (const s of sources.value) {
            if (!seen.has(s.cloud)) seen.set(s.cloud, cloudLabel(s.cloud))
        }
        return Array.from(seen.entries())
            .sort((a, b) => CLOUD_ORDER.indexOf(a[0]) - CLOUD_ORDER.indexOf(b[0]))
            .map(([value, label]) => ({ value, label }))
    })

    /**
     * 云账号选项（账号级筛选下拉；2026-10-28 口径确认:聚合/诊断请求补 account_ids）。
     * 由源清单推导（去重 account_id），组序按 CLOUD_ORDER;值为平台内账号 ID(number,
     * 与请求契约一致 —— LogSource.account_id 为展示用 string,此处转 number)。
     */
    const accountOptions = computed(() => {
        const seen = new Map<number, { value: number; label: string; cloud: string }>()
        for (const s of filteredSources.value) {
            const id = Number(s.account_id)
            if (!id || seen.has(id)) continue
            seen.set(id, { value: id, label: `${cloudLabel(s.cloud)}·${s.account_name}`, cloud: s.cloud })
        }
        return Array.from(seen.values()).sort(
            (a, b) => CLOUD_ORDER.indexOf(a.cloud) - CLOUD_ORDER.indexOf(b.cloud),
        )
    })

    /** 未开启投递的源（模板用于引导文案提示） */
    const disabledSources = computed(() => filteredSources.value.filter((s) => !s.enabled))

    /**
     * 加载当前类型的日志源。
     * force=false 时优先命中本地缓存（切 Tab 零请求）；force=true 走「刷新源列表」按钮。
     * 成功后清理失效的资源选择，并在用户未手动改过云选择时收敛到实际有源的默认云。
     */
    async function loadSources(force = false) {
        sourcesLoading.value = true
        try {
            // 源清单变动频率低（CDN/WAF 域名、S3 前缀、LTS 流）：切 Tab 复用本地
            // 缓存立即渲染，零请求；force=true（手动「刷新源列表」）强制重拉。
            const cached = sourcesCache.value[activeType.value]
            if (cached && cached.length > 0 && !force) {
                sources.value = cached
            } else {
                const list = await getLogSourcesApi({ log_type: activeType.value })
                sources.value = list
                sourcesCache.value = { ...sourcesCache.value, [activeType.value]: list }
            }
            // 清除已失效的资源选择
            const valid = new Set(sources.value.map((s) => s.resource_id))
            selectedResources.value = selectedResources.value.filter((r) => valid.has(r))
            // 首次加载：云选择收敛到实际有源的默认云（避免空选导致"全部云"联邦扫）
            if (!cloudsTouched.value) {
                const available = new Set(sources.value.map((s) => s.cloud))
                selectedClouds.value = defaultClouds.filter((c) => available.has(c))
            }
        } catch {
            // 加载失败：清空源列表并给出可见报错；云选择保持原值不动（上方云收敛只在成功路径执行），
            // 避免退化成全云联邦扫
            sources.value = []
            ElMessage.error('日志源列表加载失败,请刷新重试')
        } finally {
            sourcesLoading.value = false
        }
    }

    /** 手动强制刷新源列表（新增域名/源时兜底；平时缓存即可） */
    function refreshSources() {
        void loadSources(true)
    }

    return {
        sources,
        sourcesLoading,
        sourcesCache,
        filteredSources,
        sourceGroups,
        availableClouds,
        accountOptions,
        disabledSources,
        loadSources,
        refreshSources,
    }
}
