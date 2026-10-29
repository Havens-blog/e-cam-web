import { getEcmdbToken } from '@/utils/cookie'
import { handleApiError } from '@/utils/error-handler'
import type { AxiosResponse } from 'axios'
import { logError, logInfo, logWarn } from '@/utils/error-logger'
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { RequestConfig, RequestInterceptors, ResponseData } from './types'

// 防止多个并发 401 请求重复跳转登录页
let isRedirectingToLogin = false
// 路由守卫在发起 fetchUserInfo 之前登记目标页：401 拦截器往往先于守卫的回调触发跳转，
// 若不预先登记，拦截器会用「导航前的旧 URL」拼登录地址，登录后回到错误页面。
let pendingRedirectTarget: string | undefined

/**
 * 请求失败归一（Option A，2026-10-29 维护者确认）。
 *
 * 原实现在 `request<T>()` 的 catch 里直接 `reject(error.response ? error.response.data : error)`
 * —— 把**响应体普通对象**抛给调用方，而调用方普遍按 `Error`/`AxiosError` 假设取值：
 *   - `err instanceof Error ? err.message : String(e)` → 渲染成 `[object Object]`（#51 实测）；
 *   - 基于文案的分支静默失效（如 `isScanConfirmError` 的「确认并继续分析」通道）；
 *   - `err.response?.data?.msg` 取值点恒不可达（4 处）。
 *
 * 归一为 `Error`（message 取值链：`msg` → `message` → `error.msg`/`error.message`（证书域
 * 信封 `{success,data,error,meta}` 的文案位置）→ 原始 `err.message` → 通用文案），并附带：
 *   - `payload`：原始响应体（保留 code 等原貌，供需要时读取）；
 *   - `status`：HTTP 状态码；
 *   - `response`：`{ data, status }` 形态，兼容既有的 AxiosError 取值写法。
 *
 * 特殊路径**原样透传**，不改变既有语义：
 *   - 取消（`code === 'ERR_CANCELED'`）：调用方依赖该 code 判定「查询已取消」；
 *   - 无响应的网络/超时错误：调用方按 `err.message`/`code` 判定，保持原对象。
 */
export function normalizeRequestError(error: unknown): unknown {
    if (!error || typeof error !== 'object') return error
    const err = error as {
        code?: string
        message?: string
        response?: { data?: unknown; status?: number }
    }
    // 取消：原样透传（axios CanceledError 的 code 即 ERR_CANCELED）
    if (err.code === 'ERR_CANCELED') return error
    // 无 HTTP 响应（网络错误/超时/业务错误已由拦截器转成 Error）：保持原样
    if (!err.response) return error

    const body = err.response.data
    const status = err.response.status
    const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v : '')
    const asRecord = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
    const bodyRec = asRecord(body)
    const envelopeError = asRecord(bodyRec.error)
    const msg =
        // 主实例信封 {code,data,msg}
        pick(bodyRec.msg) ||
        pick(bodyRec.message) ||
        // 证书域信封 {success,data,error,meta}：文案在 data.error.message（api-handbook 契约）
        pick(envelopeError.msg) ||
        pick(envelopeError.message) ||
        pick(err.message) ||
        '请求失败'

    const normalized = new Error(msg)
    return Object.assign(normalized, {
        payload: body,
        status,
        // 兼容按 AxiosError 取值的调用点（err.response?.data?.msg）
        response: { data: body, status },
    })
}

/**
 * 登录目标唯一取值处（RC#2，platform-console 任务 2.13）：
 * 401/会话过期与登出后的登录页从 ecmdb-web /login 切到控制台 /console/login。
 * 目标由 build 期 env 注入（VITE_LOGIN_TARGET），默认控制台登录页相对路径；
 * redirectToLogin、stores/user logout、ErrorDisplay「重新登录」均经本函数取值，
 * 不得再散落硬编码登录地址。
 */
export function resolveLoginTarget(): string {
    return import.meta.env.VITE_LOGIN_TARGET || '/console/login'
}

/**
 * 把应用内路径（不含 base，如 /audit/logs）转成可回跳的绝对地址。
 * 微服务部署在 base=/cam/ 下，router 的 fullPath 不含该前缀，故这里补 base。
 */
export function appUrlForPath(fullPath: string): string {
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    const path = fullPath.startsWith('/') ? fullPath : `/${fullPath}`
    return `${window.location.origin}${base}${path}`
}

/** 登记「登录成功后应回跳的目标页」；守卫在导航被拦截前调用 */
export function setPendingRedirectTarget(url?: string) {
    pendingRedirectTarget = url
}

/**
 * 统一跳转登录页（防重复）
 * @param redirectTo 回跳地址。优先级：显式参数 > 守卫登记的目标页 > 当前 URL。
 *   路由守卫应传「要去的目标页」：SPA 内 push 尚未生效时 window.location.href 仍是旧页，
 *   直接用它会令用户登录后回到错误页面。
 */
export function redirectToLogin(redirectTo?: string) {
    if (isRedirectingToLogin) return
    isRedirectingToLogin = true
    // 注意：这里不清除 ecmdb-token-key。
    // 该 cookie 是 ecmdb / eiam / e-cam-service 共用的平台凭证，注销它是 eiam
    // logout 的职责。本函数的触发条件（单次请求 401、或路由守卫判定无 token /
    // 拉取用户信息失败）全都只是本应用的局部判断；若在此删除 cookie，会把其他
    // 服务（尤其 ecmdb）的登录态一并清掉，使局部故障扩散为全平台掉线。
    ElMessage.warning('登录状态已失效，请重新登录')
    const currentUrl = redirectTo || pendingRedirectTarget || window.location.href
    pendingRedirectTarget = undefined
    window.location.href = `${resolveLoginTarget()}?redirect=${encodeURIComponent(currentUrl)}`
}

/** 头部嗅探窗口：只用来判断"是不是以 { 开头" */
const HEAD_BYTES = 512
/** 超过这个体积的信封不合常理，只按头部判定 */
const ENVELOPE_MAX_BYTES = 64 * 1024
/** 超过此体积的 JSON 文件不再整份解析判信封：解析成本（50MB ≈ 0.5–1s 冻结）远大于漏判风险 */
const PARSE_MAX_BYTES = 256 * 1024

/**
 * 二进制下载接口在 HTTP 200 时也可能返回**业务信封**（如 { code: 500, msg: '无权限' }），
 * 若直接落盘会得到一个内容为错误 JSON 的 .csv 并提示「导出成功」。
 * 这里按内容嗅探：解析出对象且带 code 字段 → 视为业务响应，提示错误并 reject。
 * 注意不能一律拒绝 JSON：JSON 格式导出（format=json）本身就是合法文件（顶层是数组或数据对象）。
 */
export async function assertBinaryPayload(response: AxiosResponse) {
    const data = response.data
    if (!(data instanceof Blob)) return response
    // 老浏览器没有 Blob.text()（构建 target=es2015 且无 polyfill），无法嗅探时按文件放行
    if (typeof data.text !== 'function') return response

    const headerType = String(response.headers?.['content-type'] ?? '')
    const type = (data.type || headerType).toLowerCase()
    const isJsonType = type.includes('json')

    // 信封必然很小；小文件整份解析（能覆盖「前导空白超过头部窗口」的情况），
    // 大文件只看前 512 字节，避免对 4MB 级导出全量 text()+JSON.parse（实测 37ms → 0.2ms）。
    const whole = data.size <= ENVELOPE_MAX_BYTES
    let text: string
    if (whole) {
        text = await data.text().catch(() => '')
    } else {
        const head = await data.slice(0, HEAD_BYTES).text().catch(() => '')
        // 头部里没有对象起始符：CSV / JSON 数组 / 二进制，直接放行
        if (head.trimStart()[0] !== '{') return response
        // 头部像对象的大文件：只有声明 JSON 才值得整份解析，且体积超出上限就放弃（信封不可能这么大）
        if (!isJsonType) return response
        if (data.size > PARSE_MAX_BYTES) return response
        text = await data.text().catch(() => head)
    }

    let payload: unknown
    try {
        payload = JSON.parse(text)
    } catch {
        return response
    }

    // 顶层数组 / 非对象：正常数据文件
    if (Array.isArray(payload) || payload === null || typeof payload !== 'object') return response
    const record = payload as Record<string, unknown>
    if (!('code' in record)) return response

    // code 必须是数字（或纯数字字符串）：像 {"code":"CN","rows":[...]} 这类合法导出不能被误判
    const rawCode = record.code
    const numericCode =
        typeof rawCode === 'number'
            ? rawCode
            : typeof rawCode === 'string' && /^\d+$/.test(rawCode.trim())
              ? Number(rawCode.trim())
              : null
    if (numericCode === null) return response

    const envelope = record as { code: number | string; msg?: string; message?: string; data?: unknown }
    if (numericCode === 0 || numericCode === 200) {
        const inner = envelope.data
        // 只接受「非空数组 / 非空对象」：标量与空容器重建出来就是坏文件
        const hasData = Array.isArray(inner)
            ? inner.length > 0
            : inner !== null && typeof inner === 'object' && Object.keys(inner as object).length > 0
        if (hasData) {
            response.data = new Blob([JSON.stringify(inner)], { type: 'application/json' })
            return response
        }
        throw new Error('接口未返回文件，请稍后重试')
    }

    throw new Error(envelope.msg || envelope.message || '导出失败')
}

class HttpRequest {
    instance: AxiosInstance
    interceptors?: RequestInterceptors

    constructor(config: RequestConfig) {
        this.instance = axios.create(config)
        this.interceptors = config.interceptors

        // 实例级别的请求拦截
        this.instance.interceptors.request.use(
            this.interceptors?.requestInterceptor,
            this.interceptors?.requestInterceptorCatch
        )

        // 实例级别的响应拦截
        this.instance.interceptors.response.use(
            this.interceptors?.responseInterceptor,
            this.interceptors?.responseInterceptorCatch
        )

        // 全局请求拦截
        this.instance.interceptors.request.use(
            (config) => {
                // ecmdb session 认证：从 cookie 读取 token
                const token = getEcmdbToken()
                if (token && config.headers) {
                    config.headers.Authorization = `Bearer ${token}`
                }

                // 添加请求 ID 用于追踪
                const requestId = this.generateRequestId()
                if (config.headers) {
                    config.headers['X-Request-ID'] = requestId
                }

                // 记录请求日志
                logInfo(`API Request: ${config.method?.toUpperCase()} ${config.url}`, {
                    requestId,
                    params: config.params,
                    data: config.data,
                }, 'API')

                return config
            },
            (error) => {
                logError('Request interceptor error', error, 'API')
                return Promise.reject(error)
            }
        )

        // 全局响应拦截
        this.instance.interceptors.response.use(
            (response) => {
                const apiData = response.data
                const requestId = response.config.headers?.['X-Request-ID']

                // 记录响应日志
                logInfo(`API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
                    requestId,
                    status: response.status,
                    code: apiData.code,
                }, 'API')

                // 二进制数据：保留 AxiosResponse 形状返回（调用方统一取 res.data），
                // 直接返回 apiData 会让后续单次拦截器收到 Blob 而读到 undefined.code（曾致导出报 TypeError）。
                // config 是调用方原样传入、与适配器无关的权威来源，故优先于 request。
                const responseType = response.config?.responseType ?? response.request?.responseType
                if (responseType === 'blob' || responseType === 'arraybuffer') {
                    return assertBinaryPayload(response)
                }

                const code = apiData.code

                // 如果没有code字段，说明不是标准格式
                if (code === undefined) {
                    logWarn('Invalid API response format', { requestId, response: apiData }, 'API')
                    ElMessage.error('接口响应格式错误')
                    return Promise.reject(new Error('接口响应格式错误'))
                }

                // code为0或200都视为成功
                if (code === 0 || code === 200) {
                    return response
                }

                // 其他code视为业务错误（信封字段为 msg，message 为兼容旧后端）
                logWarn('Business error', {
                    requestId,
                    code,
                    message: apiData.message || apiData.msg,
                }, 'API')

                ElMessage.error(apiData.message || apiData.msg || 'Error')
                return Promise.reject(new Error(apiData.message || apiData.msg || 'Error'))
            },
            (error) => {
                const requestId = error.config?.headers?.['X-Request-ID']

                // 记录错误日志
                logError('API Error', {
                    requestId,
                    url: error.config?.url,
                    method: error.config?.method,
                    status: error.response?.status,
                    message: error.message,
                }, 'API')

                // 401 未认证：session 过期或未登录，跳转到控制台登录页（/console/login）
                if (error.response?.status === 401) {
                    logWarn('Session expired, redirecting to console login', {}, 'AUTH')
                    redirectToLogin()
                    return Promise.reject(error)
                }

                // 403 无权限
                if (error.response?.status === 403) {
                    ElMessage.error('权限不足，请联系管理员')
                    return Promise.reject(error)
                }

                // 使用统一错误处理
                handleApiError(error)

                return Promise.reject(error)
            }
        )
    }

    request<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return new Promise((resolve, reject) => {
            // 单次请求拦截
            if (config.interceptorsToOnce?.requestInterceptor) {
                config = config.interceptorsToOnce.requestInterceptor(config)
            }

            this.instance
                .request(config)
                .then((res) => {
                    // 单次响应拦截
                    if (config.interceptorsToOnce?.responseInterceptor) {
                        res = config.interceptorsToOnce.responseInterceptor(res)
                    }
                    resolve(res.data)
                })
                .catch((error) => {
                    // 失败归一见 normalizeRequestError：错误对象形态统一为 Error（携带服务端原因）
                    reject(normalizeRequestError(error))
                })
        })
    }

    get<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'get' })
    }

    post<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'post' })
    }

    put<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'put' })
    }

    delete<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'delete' })
    }

    patch<T>(config: RequestConfig): Promise<ResponseData<T>> {
        return this.request<T>({ ...config, method: 'patch' })
    }

    /**
     * 生成请求 ID
     */
    private generateRequestId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
}

export default HttpRequest
