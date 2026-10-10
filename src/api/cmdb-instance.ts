/**
 * CMDB 实例回写 API（云管 ECS 主机编辑同步资产属性用）
 *
 * 说明：CMDB 已拆分为独立服务 e-cmdb-service，前端页面与完整 cmdb.ts 迁至 e-cmdb-web。
 * 但云管 ECS 主机编辑仍需回写 CMDB 实例（资产名 / 自定义属性），故在 e-cam-web
 * 保留此精简版，指向 e-cmdb-service（PUT /api/v1/cmdb/instances/:id）。
 */
import type { AxiosResponse } from 'axios'
import instance from './request/service'

/** CMDB 响应拦截器：后端 code 200 归一为 0，code 0 直通 */
function createCmdbApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data

            if (data.code === 200) {
                response.data = {
                    code: 0,
                    data: data.data,
                    message: data.msg || data.message || 'success'
                }
                return response
            }

            if (data.code === 0) {
                return response
            }

            if (data.code === undefined) {
                response.data = {
                    code: 0,
                    data: data,
                    message: 'success'
                }
                return response
            }

            return response
        }
    }
}

export interface UpdateInstanceReq {
    asset_name?: string
    attributes?: Record<string, any>
}

export interface SuccessResp {
    code: number
    msg: string
    data?: any
}

/** 更新 CMDB 实例（PUT /cmdb/instances/:id → e-cmdb-service） */
export function updateCmdbInstanceApi(id: number, data: UpdateInstanceReq) {
    return instance.put<SuccessResp>({
        url: `/cmdb/instances/${id}`,
        data,
        interceptorsToOnce: createCmdbApiInterceptor()
    })
}
