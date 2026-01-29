/**
 * 数据库资源类型定义
 */

// ==================== 通用类型 ====================

/** 数据库类型 */
export type DatabaseType = 'rds' | 'redis' | 'mongodb'

/** 付费类型 */
export type PayType = 'PrePaid' | 'PostPaid'

/** 实例状态 */
export type InstanceStatus = 'running' | 'stopped' | 'creating' | 'deleting' | 'restarting' | 'upgrading'

/** 通用查询参数 */
export interface DatabaseQueryParams {
    account_id: number
    region: string
}

// ==================== RDS 类型 ====================

/** RDS 数据库引擎 */
export type RDSEngine = 'mysql' | 'postgresql' | 'mariadb' | 'sqlserver'

/** RDS 实例 */
export interface RDSInstance {
    instance_id: string
    instance_name: string
    engine: RDSEngine
    engine_version: string
    instance_class: string
    instance_status: InstanceStatus
    connection_string: string
    port: number
    vpc_id: string
    vswitch_id: string
    zone_id: string
    region_id: string
    storage_type: string
    storage_size: number
    max_connections: number
    max_iops: number
    create_time: string
    expire_time: string
    pay_type: PayType
    tags: Record<string, string>
}

/** RDS 列表查询参数 */
export interface ListRDSParams extends DatabaseQueryParams {
    engine?: RDSEngine
    status?: InstanceStatus
}

/** RDS 列表响应 */
export interface ListRDSResponse {
    instances: RDSInstance[]
    total: number
}

// ==================== Redis 类型 ====================

/** Redis 架构类型 */
export type RedisArchitecture = 'standard' | 'cluster' | 'rwsplit'

/** Redis 实例 */
export interface RedisInstance {
    instance_id: string
    instance_name: string
    instance_class: string
    instance_status: InstanceStatus
    engine_version: string
    architecture: RedisArchitecture
    node_type: string
    shard_count: number
    connection_domain: string
    port: number
    vpc_id: string
    vswitch_id: string
    zone_id: string
    region_id: string
    capacity: number
    bandwidth: number
    connections: number
    qps: number
    create_time: string
    expire_time: string
    pay_type: PayType
    tags: Record<string, string>
}

/** Redis 列表查询参数 */
export interface ListRedisParams extends DatabaseQueryParams {
    architecture?: RedisArchitecture
    status?: InstanceStatus
}

/** Redis 列表响应 */
export interface ListRedisResponse {
    instances: RedisInstance[]
    total: number
}

// ==================== MongoDB 类型 ====================

/** MongoDB 数据库类型 */
export type MongoDBType = 'replicate' | 'sharding' | 'serverless'

/** MongoDB 实例 */
export interface MongoDBInstance {
    instance_id: string
    instance_name: string
    db_type: MongoDBType
    engine_version: string
    instance_class: string
    instance_status: InstanceStatus
    storage_engine: string
    replica_set_name: string
    connection_string: string
    port: number
    vpc_id: string
    vswitch_id: string
    zone_id: string
    region_id: string
    storage_type: string
    storage_size: number
    max_connections: number
    max_iops: number
    create_time: string
    expire_time: string
    pay_type: PayType
    tags: Record<string, string>
}

/** MongoDB 列表查询参数 */
export interface ListMongoDBParams extends DatabaseQueryParams {
    db_type?: MongoDBType
    status?: InstanceStatus
}

/** MongoDB 列表响应 */
export interface ListMongoDBResponse {
    instances: MongoDBInstance[]
    total: number
}

// ==================== 联合类型 ====================

/** 数据库实例联合类型 */
export type DatabaseInstance = RDSInstance | RedisInstance | MongoDBInstance
