/**
 * 主机模板与云主机创建 API
 */
import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type {
    CreateTemplateReq,
    VMTemplate
} from './types/template'

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

// ==================== 模板 CRUD ====================

export function createTemplateApi(data: CreateTemplateReq) {
    return instance.post<VMTemplate>({
        url: `${API_SERVICE.CAM}/templates`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function getTemplateApi(id: number) {
    return instance.get<VMTemplate>({
        url: `${API_SERVICE.CAM}/templates/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listTemplatesApi(params?: TemplateFilter) {
    return instance.get<{ items: VMTemplate[]; total: number }>({
        url: `${API_SERVICE.CAM}/templates`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function updateTemplateApi(id: number, data: UpdateTemplateReq) {
    return instance.put<void>({
        url: `${API_SERVICE.CAM}/templates/${id}`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function deleteTemplateApi(id: number) {
    return instance.delete<void>({
        url: `${API_SERVICE.CAM}/templates/${id}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 创建主机 ====================

export function provisionFromTemplateApi(templateId: number, data: ProvisionReq) {
    return instance.post<ProvisionResponse>({
        url: `${API_SERVICE.CAM}/templates/${templateId}/provision`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function directProvisionApi(data: DirectProvisionReq) {
    return instance.post<ProvisionResponse>({
        url: `${API_SERVICE.CAM}/provision`,
        data,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 创建任务查询 ====================

export function listProvisionTasksApi(params?: ProvisionTaskFilter) {
    return instance.get<{ items: ProvisionTask[]; total: number }>({
        url: `${API_SERVICE.CAM}/provision-tasks`,
        params,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function getProvisionTaskApi(taskId: string) {
    return instance.get<ProvisionTask>({
        url: `${API_SERVICE.CAM}/provision-tasks/${taskId}`,
        interceptorsToOnce: createCamApiInterceptor()
    })
}

// ==================== 云资源查询 ====================

export interface RegionInfo {
    id: string
    name: string
    local_name: string
    description: string
}

export function listRegionsApi(cloudAccountId: number) {
    return instance.get<RegionInfo[]>({
        url: `${API_SERVICE.CAM}/cloud-resources/regions`,
        params: { cloud_account_id: cloudAccountId },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listInstanceTypesApi(cloudAccountId: number, region: string) {
    return instance.get<InstanceTypeInfo[]>({
        url: `${API_SERVICE.CAM}/cloud-resources/instance-types`,
        params: { cloud_account_id: cloudAccountId, region },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listImagesApi(cloudAccountId: number, region: string) {
    return instance.get<ImageInfo[]>({
        url: `${API_SERVICE.CAM}/cloud-resources/images`,
        params: { cloud_account_id: cloudAccountId, region },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listVPCsApi(cloudAccountId: number, region: string) {
    return instance.get<VPCInfo[]>({
        url: `${API_SERVICE.CAM}/cloud-resources/vpcs`,
        params: { cloud_account_id: cloudAccountId, region },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listSubnetsApi(cloudAccountId: number, region: string, vpcId: string) {
    return instance.get<SubnetInfo[]>({
        url: `${API_SERVICE.CAM}/cloud-resources/subnets`,
        params: { cloud_account_id: cloudAccountId, region, vpc_id: vpcId },
        interceptorsToOnce: createCamApiInterceptor()
    })
}

export function listSecurityGroupsApi(cloudAccountId: number, region: string, vpcId: string) {
    return instance.get<SecurityGroupInfo[]>({
        url: `${API_SERVICE.CAM}/cloud-resources/security-groups`,
        params: { cloud_account_id: cloudAccountId, region, vpc_id: vpcId },
        interceptorsToOnce: createCamApiInterceptor()
    })
}
