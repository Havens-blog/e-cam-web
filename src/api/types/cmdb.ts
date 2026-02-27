/**
 * CMDB (配置管理数据库) 类型定义
 */

// ==================== 通用响应 ====================

export interface SuccessResp {
    code: number
    msg: string
    data?: any
}

export interface ErrorResp {
    code: number
    msg: string
    data?: any
}

// ==================== 模型相关 ====================

/** 资源类别 */
export type ModelCategory = 'compute' | 'storage' | 'network' | 'database' | 'security' | 'iam'

/** 云厂商 */
export type ModelProvider = 'aliyun' | 'aws' | 'azure' | 'all'

/** 创建模型请求 */
export interface CreateModelReq {
    uid: string
    name: string
    model_group_id?: number
    parent_uid?: string
    category: ModelCategory
    level?: number
    icon?: string
    description?: string
    provider?: ModelProvider
    extensible?: boolean
}

/** 更新模型请求 */
export interface UpdateModelReq {
    name?: string
    model_group_id?: number
    icon?: string
    description?: string
    extensible?: boolean
}

/** 模型视图对象 */
export interface ModelVO {
    id: number
    uid: string
    name: string
    model_group_id?: number
    parent_uid?: string
    category: string
    level: number
    icon?: string
    description?: string
    provider: string
    extensible: boolean
    create_time: number
    update_time: number
}

/** 模型列表查询参数 */
export interface ListModelsParams {
    provider?: string
    category?: string
    parent_uid?: string
    level?: number
    offset?: number
    limit?: number
}

/** 模型列表响应 */
export interface ModelListResp {
    code: number
    msg: string
    data: {
        models: ModelVO[]
        total: number
    }
}

/** 模型详情响应 */
export interface ModelResp {
    code: number
    msg: string
    data: ModelVO
}

/** 创建模型响应 */
export interface CreateModelResp {
    code: number
    msg: string
    data: {
        id: number
    }
}

// ==================== 模型分组相关 ====================

/** 创建模型分组请求 */
export interface CreateModelGroupReq {
    uid: string
    name: string
    icon?: string
    sort_order?: number
    description?: string
}

/** 更新模型分组请求 */
export interface UpdateModelGroupReq {
    name?: string
    icon?: string
    sort_order?: number
    description?: string
}

/** 模型分组视图对象 */
export interface ModelGroupVO {
    id: number
    uid: string
    name: string
    icon?: string
    sort_order: number
    is_builtin: boolean
    description?: string
    create_time: number
    update_time: number
}

/** 带模型列表的分组视图对象 */
export interface ModelGroupWithModelsVO extends ModelGroupVO {
    models: ModelVO[]
}

/** 模型分组列表响应 */
export interface ModelGroupListResp {
    code: number
    msg: string
    data: {
        groups: ModelGroupVO[]
        total: number
    }
}

/** 带模型的分组列表响应 */
export interface ModelGroupWithModelsListResp {
    code: number
    msg: string
    data: {
        groups: ModelGroupWithModelsVO[]
    }
}

/** 模型分组详情响应 */
export interface ModelGroupResp {
    code: number
    msg: string
    data: ModelGroupVO
}

// ==================== 实例相关 ====================

/** 创建实例请求 */
export interface CreateInstanceReq {
    uid: string
    asset_id: string
    asset_name?: string
    tenant_id: string
    account_id?: number
    attributes?: Record<string, any>
}

/** 更新实例请求 */
export interface UpdateInstanceReq {
    asset_name?: string
    attributes?: Record<string, any>
}

/** Upsert 实例请求 */
export interface UpsertInstanceReq {
    uid: string
    asset_id: string
    asset_name?: string
    tenant_id: string
    account_id?: number
    attributes?: Record<string, any>
}

/** 批量创建实例请求 */
export interface CreateBatchInstanceReq {
    instances: CreateInstanceReq[]
}

/** 批量 Upsert 实例请求 */
export interface UpsertBatchInstanceReq {
    instances: UpsertInstanceReq[]
}

/** 实例视图对象 */
export interface InstanceVO {
    id: number
    uid: string
    asset_id: string
    asset_name?: string
    tenant_id: string
    account_id?: number
    attributes?: Record<string, any>
    create_time: number
    update_time: number
}

/** 实例列表查询参数 */
export interface ListInstancesParams {
    uid?: string
    tenant_id?: string
    account_id?: number
    asset_name?: string
    status?: string
    region?: string
    zone?: string
    vpc_id?: string
    instance_type?: string
    os_type?: string
    charge_type?: string
    private_ip?: string
    public_ip?: string
    provider?: string
    project_id?: string
    has_tags?: boolean
    tag_key?: string
    tag_value?: string
    offset?: number
    limit?: number
}

/** 实例列表响应 */
export interface InstanceListResp {
    code: number
    msg: string
    data: {
        instances: InstanceVO[]
        total: number
    }
}

/** 实例详情响应 */
export interface InstanceResp {
    code: number
    msg: string
    data: InstanceVO
}

/** 创建实例响应 */
export interface CreateInstanceResp {
    code: number
    msg: string
    data: {
        id: number
    }
}

/** 批量创建响应 */
export interface BatchCreateResp {
    code: number
    msg: string
    data: {
        count: number
    }
}


// ==================== 模型关系类型相关 ====================

/** 关系类型枚举 */
export type RelationType = 'belongs_to' | 'contains' | 'bindto' | 'connects' | 'depends_on'

/** 关系方向枚举 */
export type RelationDirection = 'one_to_one' | 'one_to_many' | 'many_to_many'

/** 创建模型关系类型请求 */
export interface CreateModelRelationReq {
    uid: string
    name: string
    source_uid: string
    target_uid: string
    relation_type: RelationType
    direction?: RelationDirection
    source_to_target?: string
    target_to_source?: string
    description?: string
}

/** 更新模型关系类型请求 */
export interface UpdateModelRelationReq {
    name?: string
    source_to_target?: string
    target_to_source?: string
    description?: string
}

/** 模型关系类型视图对象 */
export interface ModelRelationVO {
    id: number
    uid: string
    name: string
    source_uid: string
    target_uid: string
    relation_type: string
    direction: string
    source_to_target?: string
    target_to_source?: string
    description?: string
    create_time: number
    update_time: number
}

/** 模型关系类型列表查询参数 */
export interface ListModelRelationsParams {
    source_uid?: string
    target_uid?: string
    relation_type?: string
    offset?: number
    limit?: number
}

/** 模型关系类型列表响应 */
export interface ModelRelationListResp {
    code: number
    msg: string
    data: {
        relations: ModelRelationVO[]
        total: number
    }
}

/** 模型关系类型详情响应 */
export interface ModelRelationResp {
    code: number
    msg: string
    data: ModelRelationVO
}

// ==================== 实例关系相关 ====================

/** 创建实例关系请求 */
export interface CreateInstanceRelationReq {
    source_instance_id: number
    target_instance_id: number
    relation_type_uid: string
    tenant_id: string
}

/** 批量创建实例关系请求 */
export interface CreateBatchInstanceRelationReq {
    relations: CreateInstanceRelationReq[]
}

/** 实例关系视图对象 */
export interface InstanceRelationVO {
    id: number
    source_instance_id: number
    target_instance_id: number
    relation_type_uid: string
    tenant_id: string
    create_time: number
}

/** 实例关系列表查询参数 */
export interface ListInstanceRelationsParams {
    source_instance_id?: number
    target_instance_id?: number
    relation_type_uid?: string
    tenant_id?: string
    offset?: number
    limit?: number
}

/** 实例关系列表响应 */
export interface InstanceRelationListResp {
    code: number
    msg: string
    data: {
        relations: InstanceRelationVO[]
        total: number
    }
}

// ==================== 拓扑相关 ====================

/** 拓扑节点 */
export interface TopologyNode {
    id: number
    model_uid: string
    model_name: string
    asset_id: string
    asset_name?: string
    icon?: string
    category: string
    attributes?: Record<string, any>
}

/** 拓扑边 */
export interface TopologyEdge {
    source_id: number
    target_id: number
    relation_type_uid: string
    relation_name: string
    relation_type: string
}

/** 拓扑图 */
export interface TopologyGraph {
    nodes: TopologyNode[]
    edges: TopologyEdge[]
}

/** 实例拓扑查询参数 */
export interface GetInstanceTopologyParams {
    depth?: number
    direction?: 'both' | 'outgoing' | 'incoming'
    uid?: string
    tenant_id?: string
}

/** 拓扑图响应 */
export interface TopologyGraphResp {
    code: number
    msg: string
    data: TopologyGraph
}

/** 模型拓扑节点 */
export interface ModelTopologyNode {
    uid: string
    name: string
    category: string
    provider: string
    icon?: string
}

/** 模型拓扑边 */
export interface ModelTopologyEdge {
    source_model_uid: string
    target_model_uid: string
    relation_uid: string
    relation_name: string
    relation_type: string
}

/** 模型拓扑图 */
export interface ModelTopologyGraph {
    nodes: ModelTopologyNode[]
    edges: ModelTopologyEdge[]
}

/** 模型拓扑图响应 */
export interface ModelTopologyGraphResp {
    code: number
    msg: string
    data: ModelTopologyGraph
}

/** 关联实例响应 */
export interface RelatedInstancesResp {
    code: number
    msg: string
    data: {
        instances: InstanceVO[]
        total: number
    }
}

/** 创建ID响应 */
export interface CreateIDResp {
    code: number
    msg: string
    data: {
        id: number
    }
}

// ==================== 字段类型相关 ====================

/** 字段类型枚举 */
export type FieldType = 'string' | 'text' | 'int' | 'float' | 'bool' | 'enum' | 'datetime' | 'date' | 'array' | 'json' | 'link'

/** 字段类型视图对象 */
export interface FieldTypeVO {
    value: string
    label: string
}

/** 字段类型列表响应 */
export interface FieldTypesResp {
    code: number
    msg: string
    data: FieldTypeVO[]
}

// ==================== 模型属性相关 ====================

/** 创建属性请求 */
export interface CreateAttributeReq {
    field_uid: string
    field_name: string
    field_type: FieldType
    group_id?: number
    display_name?: string
    display?: boolean
    index?: number
    required?: boolean
    editable?: boolean
    searchable?: boolean
    unique?: boolean
    secure?: boolean
    link?: boolean
    link_model?: string
    option?: string
    default?: string
    placeholder?: string
    description?: string
}

/** 更新属性请求 */
export interface UpdateAttributeReq {
    field_name?: string
    field_type?: FieldType
    group_id?: number
    display_name?: string
    display?: boolean
    index?: number
    required?: boolean
    editable?: boolean
    searchable?: boolean
    unique?: boolean
    secure?: boolean
    link?: boolean
    link_model?: string
    option?: string
    default?: string
    placeholder?: string
    description?: string
}

/** 属性视图对象 */
export interface AttributeVO {
    id: number
    field_uid: string
    field_name: string
    field_type: string
    uid: string
    group_id?: number
    display_name?: string
    display: boolean
    index: number
    required: boolean
    editable: boolean
    searchable: boolean
    unique: boolean
    secure: boolean
    link: boolean
    link_model?: string
    option?: string
    default?: string
    placeholder?: string
    description?: string
    create_time: number
    update_time: number
}

/** 属性列表查询参数 */
export interface ListAttributesParams {
    group_id?: number
    field_type?: string
    offset?: number
    limit?: number
}

/** 属性列表响应 */
export interface AttributeListResp {
    code: number
    msg: string
    data: {
        attributes: AttributeVO[]
        total: number
    }
}

/** 属性详情响应 */
export interface AttributeResp {
    code: number
    msg: string
    data: AttributeVO
}

// ==================== 属性分组相关 ====================

/** 创建属性分组请求 */
export interface CreateAttributeGroupReq {
    uid: string
    name: string
    index?: number
    description?: string
}

/** 更新属性分组请求 */
export interface UpdateAttributeGroupReq {
    name?: string
    index?: number
    description?: string
}

/** 属性分组视图对象 */
export interface AttributeGroupVO {
    id: number
    uid: string
    name: string
    index: number
    is_builtin: boolean
    description?: string
    create_time: number
    update_time: number
}

/** 带属性列表的分组视图对象 */
export interface AttributeGroupWithAttrsVO extends AttributeGroupVO {
    attributes: AttributeVO[]
}

/** 属性分组列表响应 */
export interface AttributeGroupListResp {
    code: number
    msg: string
    data: AttributeGroupVO[]
}

/** 带属性的分组列表响应 */
export interface AttributeGroupWithAttrsListResp {
    code: number
    msg: string
    data: AttributeGroupWithAttrsVO[]
}

/** 属性分组详情响应 */
export interface AttributeGroupResp {
    code: number
    msg: string
    data: AttributeGroupVO
}
