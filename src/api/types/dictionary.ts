/**
 * 数据字典 API 类型定义
 */

export interface DictType {
    id: number
    code: string
    name: string
    description: string
    status: 'enabled' | 'disabled'
    created_at: number
    updated_at: number
}

export interface DictItem {
    id: number
    dict_type_id: number
    value: string
    label: string
    sort_order: number
    status: 'enabled' | 'disabled'
    extra: Record<string, any>
    created_at: number
    updated_at: number
}

export interface CreateDictTypeReq {
    code: string
    name: string
    description?: string
}

export interface UpdateDictTypeReq {
    name: string
    description?: string
}

export interface CreateDictItemReq {
    value: string
    label: string
    sort_order?: number
    extra?: Record<string, any>
}

export interface UpdateDictItemReq {
    label: string
    sort_order?: number
    status?: string
    extra?: Record<string, any>
}

export interface DictTypeFilter {
    keyword?: string
    status?: string
    offset?: number
    limit?: number
}
