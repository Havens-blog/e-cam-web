/**
 * 多云统一日志查询 API(联邦实时查询,不落库)
 */

import instance from './request/service';
import type {
    LogSearchRequest,
    LogSearchResponse,
    LogSource,
    LogTypeMeta,
} from './types/logs';

const BASE = '/cam/logs';

/**
 * 主实例拦截器返回 ResponseData<T>({code,data,msg});统一在此解包,
 * 视图层直接拿到业务载荷(兼容拦截器直返 T 的实现变化)。
 */
function unwrap<T>(res: unknown): T {
    const envelope = res as { data?: T } | null
    if (envelope && typeof envelope === 'object' && 'data' in envelope) {
        return envelope.data as T
    }
    return res as T
}

/** 日志类型与字段字典(动态列驱动) */
export async function getLogTypesApi(): Promise<LogTypeMeta[]> {
    const res = await instance.get<LogTypeMeta[]>({
        url: `${BASE}/types`,
    })
    return unwrap<LogTypeMeta[]>(res) ?? []
}

/**
 * 日志源清单(按云账号 fan-out,含 Enabled 状态与未开启原因)
 * clouds: 逗号分隔(aliyun,huawei,aws,tencent)
 */
export async function getLogSourcesApi(params: { log_type: string; clouds?: string }): Promise<LogSource[]> {
    const res = await instance.get<LogSource[]>({
        url: `${BASE}/sources`,
        params,
    })
    return unwrap<LogSource[]>(res) ?? []
}

/** 联邦查询(单源失败隔离,per-source 状态随响应返回) */
export async function searchLogsApi(data: LogSearchRequest): Promise<LogSearchResponse> {
    const res = await instance.post<LogSearchResponse>({
        url: `${BASE}/search`,
        data,
    })
    return unwrap<LogSearchResponse>(res)
}
