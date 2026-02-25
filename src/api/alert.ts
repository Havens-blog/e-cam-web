/**
 * 告警通知 API
 * 通知渠道、告警规则、告警事件管理
 */

import instance, { API_SERVICE } from './request/service'

// ==================== 类型定义 ====================

/** 通知渠道类型 */
export type ChannelType = 'dingtalk' | 'wecom' | 'feishu' | 'email'

/** 通知渠道 */
export interface AlertChannel {
    id: number
    name: string
    type: ChannelType
    config: Record<string, any>
    tenant_id: string
    enabled: boolean
    create_time: string
    update_time: string
}

/** 告警规则类型 */
export type AlertRuleType = 'resource_change' | 'sync_failure' | 'expiration' | 'security_group'

/** 告警规则 */
export interface AlertRule {
    id: number
    name: string
    type: AlertRuleType
    channel_ids: number[]
    account_ids: number[]
    resource_types: string[]
    regions: string[]
    silence_duration: number
    escalate_after: number
    escalate_channels: number[]
    condition: Record<string, any>
    tenant_id: string
    enabled: boolean
    create_time: string
    update_time: string
}

/** 告警事件级别 */
export type AlertSeverity = 'info' | 'warning' | 'critical'

/** 告警事件状态 */
export type AlertEventStatus = 'pending' | 'sent' | 'failed' | 'silenced'

/** 告警事件 */
export interface AlertEvent {
    id: number
    rule_id: number
    type: AlertRuleType
    severity: AlertSeverity
    title: string
    content: Record<string, any>
    source: string
    tenant_id: string
    status: AlertEventStatus
    retry_count: number
    create_time: string
    sent_at: string
}

/** 列表响应 */
interface ListResponse<T> {
    items: T[]
    total: number
}

// ==================== 通知渠道 API ====================

export function listChannelsApi(params?: { type?: ChannelType; offset?: number; limit?: number }) {
    return instance.get<ListResponse<AlertChannel>>({
        url: `${API_SERVICE.CAM}/alert/channels`,
        params,
    })
}

export function getChannelApi(id: number) {
    return instance.get<AlertChannel>({
        url: `${API_SERVICE.CAM}/alert/channels/${id}`,
    })
}

export function createChannelApi(data: { name: string; type: ChannelType; config: Record<string, any> }) {
    return instance.post<{ id: number }>({
        url: `${API_SERVICE.CAM}/alert/channels`,
        data,
    })
}

export function updateChannelApi(id: number, data: { name: string; type: ChannelType; config: Record<string, any> }) {
    return instance.put<null>({
        url: `${API_SERVICE.CAM}/alert/channels/${id}`,
        data,
    })
}

export function deleteChannelApi(id: number) {
    return instance.delete<null>({
        url: `${API_SERVICE.CAM}/alert/channels/${id}`,
    })
}

export function testChannelApi(id: number) {
    return instance.post<null>({
        url: `${API_SERVICE.CAM}/alert/channels/${id}/test`,
    })
}

// ==================== 告警规则 API ====================

export function listRulesApi(params?: { type?: AlertRuleType; offset?: number; limit?: number }) {
    return instance.get<ListResponse<AlertRule>>({
        url: `${API_SERVICE.CAM}/alert/rules`,
        params,
    })
}

export function getRuleApi(id: number) {
    return instance.get<AlertRule>({
        url: `${API_SERVICE.CAM}/alert/rules/${id}`,
    })
}

export function createRuleApi(data: {
    name: string
    type: AlertRuleType
    channel_ids: number[]
    account_ids?: number[]
    resource_types?: string[]
    regions?: string[]
    silence_duration?: number
    escalate_after?: number
    escalate_channels?: number[]
    condition?: Record<string, any>
}) {
    return instance.post<{ id: number }>({
        url: `${API_SERVICE.CAM}/alert/rules`,
        data,
    })
}

export function updateRuleApi(id: number, data: {
    name: string
    type: AlertRuleType
    channel_ids: number[]
    account_ids?: number[]
    resource_types?: string[]
    regions?: string[]
    silence_duration?: number
    escalate_after?: number
    escalate_channels?: number[]
    condition?: Record<string, any>
}) {
    return instance.put<null>({
        url: `${API_SERVICE.CAM}/alert/rules/${id}`,
        data,
    })
}

export function deleteRuleApi(id: number) {
    return instance.delete<null>({
        url: `${API_SERVICE.CAM}/alert/rules/${id}`,
    })
}

export function toggleRuleApi(id: number, enabled: boolean) {
    return instance.put<null>({
        url: `${API_SERVICE.CAM}/alert/rules/${id}/toggle`,
        data: { enabled },
    })
}

// ==================== 告警事件 API ====================

export function listEventsApi(params?: {
    type?: AlertRuleType
    severity?: AlertSeverity
    status?: AlertEventStatus
    offset?: number
    limit?: number
}) {
    return instance.get<ListResponse<AlertEvent>>({
        url: `${API_SERVICE.CAM}/alert/events`,
        params,
    })
}
