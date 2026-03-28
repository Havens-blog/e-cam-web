/**
 * 数据字典 API
 */
import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type {
    CreateDictItemReq,
    CreateDictTypeReq,
    DictItem,
    DictType,
    DictTypeFilter,
    UpdateDictItemReq,
    UpdateDictTypeReq
} from './types/dictionary'

// CAM API 响应拦截器
function createCamApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data
            if (data.code === 200) {
                response.data = { code: 0, data: data.data, message: data.msg || data.message || 'success' }
                return response
            }
            if (data.code === 0) return response
            if (data.code === undefined) {
                response.data = { code: 0, data: data, message: 'success' }
                return response
            }
            return response
        }
    }
}

// ==================== 字典类型管理 ====================

export function createDictTypeApi(data: CreateDictTypeReq) {
    return instance.post<DictType>({
        url: `${API_SERVICE.CAM}/dict/types`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function updateDictTypeApi(id: number, data: UpdateDictTypeReq) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/dict/types/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}


export function deleteDictTypeApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/dict/types/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listDictTypesApi(params?: DictTypeFilter) {
    return instance.get<{ items: DictType[]; total: number }>({
        url: `${API_SERVICE.CAM}/dict/types`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function updateDictTypeStatusApi(id: number, status: string) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/dict/types/${id}/status`,
        data: { status },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 字典项管理 ====================

export function createDictItemApi(typeId: number, data: CreateDictItemReq) {
    return instance.post<DictItem>({
        url: `${API_SERVICE.CAM}/dict/types/${typeId}/items`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function updateDictItemApi(id: number, data: UpdateDictItemReq) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/dict/items/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function deleteDictItemApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/dict/items/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listDictItemsApi(typeId: number) {
    return instance.get<DictItem[]>({
        url: `${API_SERVICE.CAM}/dict/types/${typeId}/items`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function updateDictItemStatusApi(id: number, status: string) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/dict/items/${id}/status`,
        data: { status },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 业务查询接口 ====================

export function getDictByCodeApi(code: string) {
    return instance.get<DictItem[]>({
        url: `${API_SERVICE.CAM}/dict/data/${code}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function batchGetDictByCodesApi(codes: string[]) {
    return instance.get<Record<string, DictItem[]>>({
        url: `${API_SERVICE.CAM}/dict/data/batch`,
        params: { codes: codes.join(',') },
        interceptorsToOnce: createCamApiInterceptor()
    })
}
