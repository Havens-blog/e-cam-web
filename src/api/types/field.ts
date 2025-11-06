/**
 * 字段管理相关类型定义
 */

/**
 * 字段对象
 */
export interface ModelField {
    id: number
    field_uid: string
    model_uid: string
    field_name: string
    display_name: string
    field_type: string
    required: boolean
    display: boolean
    link: boolean
    link_model?: string
    secure: boolean
    option?: string
    group_id?: number
    index: number
    create_time: string
    update_time: string
}

/**
 * 字段分组对象
 */
export interface ModelFieldGroup {
    id: number
    model_uid: string
    name: string
    index: number
    create_time: string
    update_time: string
}

/**
 * 创建字段请求
 */
export interface CreateFieldRequest {
    field_uid: string
    field_name: string
    display_name: string
    field_type: string
    required?: boolean
    display?: boolean
    link?: boolean
    link_model?: string
    secure?: boolean
    option?: string
    group_id?: number
    index?: number
}

/**
 * 更新字段请求
 */
export interface UpdateFieldRequest {
    display_name?: string
    required?: boolean
    display?: boolean
    option?: string
    index?: number
}

/**
 * 创建字段分组请求
 */
export interface CreateFieldGroupRequest {
    name: string
    index?: number
}

/**
 * 更新字段分组请求
 */
export interface UpdateFieldGroupRequest {
    name?: string
    index?: number
}
