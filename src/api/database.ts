/**
 * 数据库资源 API
 * RDS、Redis、MongoDB 实例管理接口
 */

import type { AxiosResponse } from 'axios'
import instance, { API_SERVICE } from './request/service'
import type * as db from './types/database'

// 数据库 API 响应拦截器
function createDatabaseApiInterceptor() {
    return {
        responseInterceptor: (response: AxiosResponse) => {
            const data = response.data
            if (data.code === 0) {
                return response
            }
            if (data.code === undefined) {
                response.data = { code: 0, data: data, message: 'success' }
                return response
            }
            return response
        }
    }
}

// ==================== RDS API ====================

/** 获取 RDS 实例列表 */
export function listRDSInstancesApi(params: db.ListRDSParams) {
    return instance.get<db.ListRDSResponse>({
        url: `${API_SERVICE.CAM}/databases/rds`,
        params,
        interceptorsToOnce: createDatabaseApiInterceptor()
    })
}

/** 获取 RDS 实例详情 */
export function getRDSInstanceApi(instanceId: string, params: db.DatabaseQueryParams) {
    return instance.get<db.RDSInstance>({
        url: `${API_SERVICE.CAM}/databases/rds/${instanceId}`,
        params,
        interceptorsToOnce: createDatabaseApiInterceptor()
    })
}

// ==================== Redis API ====================

/** 获取 Redis 实例列表 */
export function listRedisInstancesApi(params: db.ListRedisParams) {
    return instance.get<db.ListRedisResponse>({
        url: `${API_SERVICE.CAM}/databases/redis`,
        params,
        interceptorsToOnce: createDatabaseApiInterceptor()
    })
}

/** 获取 Redis 实例详情 */
export function getRedisInstanceApi(instanceId: string, params: db.DatabaseQueryParams) {
    return instance.get<db.RedisInstance>({
        url: `${API_SERVICE.CAM}/databases/redis/${instanceId}`,
        params,
        interceptorsToOnce: createDatabaseApiInterceptor()
    })
}

// ==================== MongoDB API ====================

/** 获取 MongoDB 实例列表 */
export function listMongoDBInstancesApi(params: db.ListMongoDBParams) {
    return instance.get<db.ListMongoDBResponse>({
        url: `${API_SERVICE.CAM}/databases/mongodb`,
        params,
        interceptorsToOnce: createDatabaseApiInterceptor()
    })
}

/** 获取 MongoDB 实例详情 */
export function getMongoDBInstanceApi(instanceId: string, params: db.DatabaseQueryParams) {
    return instance.get<db.MongoDBInstance>({
        url: `${API_SERVICE.CAM}/databases/mongodb/${instanceId}`,
        params,
        interceptorsToOnce: createDatabaseApiInterceptor()
    })
}
