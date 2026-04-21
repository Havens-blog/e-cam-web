/**
 * 主机模板与云主机创建 API 类型定义
 */

// ==================== 数据盘配置 ====================

export interface DataDiskConfig {
    category: string
    size: number
}

// ==================== 主机模板 ====================

export interface VMTemplate {
    id: number
    name: string
    description: string
    tenant_id: string
    provider: string
    cloud_account_id: number
    region: string
    zone: string
    instance_type: string
    image_id: string
    vpc_id: string
    subnet_id: string
    security_group_ids: string[]
    instance_name_prefix: string
    host_name_prefix: string
    system_disk_type: string
    system_disk_size: number
    data_disks: DataDiskConfig[]
    bandwidth_out: number
    charge_type: string
    key_pair_name: string
    tags: Record<string, string>
    created_at: number
    updated_at: number
}

export interface CreateTemplateReq {
    name: string
    description?: string
    provider?: string
    cloud_account_id?: number
    region?: string
    zone?: string
    instance_type?: string
    image_id?: string
    vpc_id?: string
    subnet_id?: string
    security_group_ids?: string[]
    instance_name_prefix?: string
    host_name_prefix?: string
    system_disk_type?: string
    system_disk_size?: number
    data_disks?: DataDiskConfig[]
    bandwidth_out?: number
    charge_type?: string
    key_pair_name?: string
    tags?: Record<string, string>
}

export interface UpdateTemplateReq {
    name?: string
    description?: string
    provider?: string
    cloud_account_id?: number
    region?: string
    zone?: string
    instance_type?: string
    image_id?: string
    vpc_id?: string
    subnet_id?: string
    security_group_ids?: string[]
    instance_name_prefix?: string
    host_name_prefix?: string
    system_disk_type?: string
    system_disk_size?: number
    data_disks?: DataDiskConfig[]
    bandwidth_out?: number
    charge_type?: string
    key_pair_name?: string
    tags?: Record<string, string>
}

export interface TemplateFilter {
    name?: string
    provider?: string
    cloud_account_id?: number
    offset?: number
    limit?: number
}

// ==================== 创建主机请求 ====================

export interface ProvisionReq {
    count: number
    instance_name_prefix?: string
    tags?: Record<string, string>
}

export interface DirectProvisionReq {
    provider: string
    cloud_account_id: number
    region: string
    zone: string
    instance_type: string
    image_id: string
    vpc_id: string
    subnet_id: string
    security_group_ids: string[]
    count: number
    instance_name_prefix?: string
    host_name_prefix?: string
    system_disk_type?: string
    system_disk_size?: number
    data_disks?: DataDiskConfig[]
    bandwidth_out?: number
    charge_type?: string
    key_pair_name?: string
    tags?: Record<string, string>
    description?: string
}

// ==================== 创建任务 ====================

export interface ProvisionInstanceResult {
    index: number
    name: string
    instance_id: string
    status: string
    error: string
    sync_status: string
}

export interface ProvisionTask {
    id: string
    tenant_id: string
    source: 'from_template' | 'direct'
    template_id: number
    direct_params?: DirectProvisionParams
    count: number
    instance_name_prefix: string
    override_tags: Record<string, string>
    status: string
    progress: number
    message: string
    success_count: number
    failed_count: number
    instances: ProvisionInstanceResult[]
    sync_status: string
    created_by: string
    created_at: number
    updated_at: number
}

export interface DirectProvisionParams {
    provider: string
    cloud_account_id: number
    region: string
    zone: string
    instance_type: string
    image_id: string
    vpc_id: string
    subnet_id: string
    security_group_ids: string[]
    instance_name_prefix: string
    host_name_prefix: string
    system_disk_type: string
    system_disk_size: number
    data_disks: DataDiskConfig[]
    bandwidth_out: number
    charge_type: string
    key_pair_name: string
    tags: Record<string, string>
    description: string
}

export interface ProvisionTaskFilter {
    template_id?: number
    status?: string
    source?: string
    start_time?: number
    end_time?: number
    offset?: number
    limit?: number
}

// ==================== 云资源查询 ====================

export interface InstanceTypeInfo {
    instance_type: string
    cpu: number
    memory_gb: number
}

export interface ImageInfo {
    image_id: string
    name: string
    os_type: string
    platform: string
}

export interface VPCInfo {
    vpc_id: string
    vpc_name: string
    cidr_block: string
    status: string
}

export interface SubnetInfo {
    subnet_id: string
    name: string
    cidr_block: string
    zone: string
    vpc_id: string
}

export interface SecurityGroupInfo {
    security_group_id: string
    name: string
    description: string
    vpc_id: string
}

// ==================== 通用响应 ====================

export interface ListResponse<T> {
    items: T[]
    total: number
}

export interface ProvisionResponse {
    task_id: string
}
