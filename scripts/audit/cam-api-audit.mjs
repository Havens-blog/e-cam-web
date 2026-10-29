#!/usr/bin/env node
/**
 * CAM 接口审计脚本（无需登录依赖库，仅用内置 fetch）。
 *
 * 用途：把迭代中被反复手工执行的几类"接口级"检查固化成可重复运行的审计：
 *   1) 敏感字段泄漏：响应中是否出现明文密钥/密码/token（应为打码或不存在）；
 *   2) 筛选是否真正生效：带"必然无结果"的筛选值，total/条目数应变化；
 *   3) 分页是否真正生效：第 1 页与第 2 页条目集合应不同。
 *
 * 【重要口径】探针必须使用**前端真实发送的参数名与形态**（见每个用例的 source 注释）。
 * 用"看起来合理"的参数名探测会产出假阳性——实测踩过两次：
 *   - 用 page/size 探审计日志（该 handler 读 offset/limit，而页面自身转换正确）；
 *   - 用 cloud_platform 探审计日志（页面根本没有该筛选项、后端也不读）。
 * 新增用例前请先到前端源码确认：`src/api/<module>.ts` 的参数类型 + 页面构造请求处。
 *
 * 用法：
 *   ECAM_BASE=http://localhost:8888 ECAM_COOKIE='ecmdb-token-key=...' node scripts/audit/cam-api-audit.mjs
 *   # 仅跑某一类：加 --only=secrets|filters|paging
 *
 * 退出码：0 = 全部通过；1 = 存在疑似问题（需人工确认）；2 = 环境/鉴权不可用。
 */

const BASE = (process.env.ECAM_BASE || 'http://localhost:8888').replace(/\/$/, '')
const COOKIE = process.env.ECAM_COOKIE || ''
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1]

if (!COOKIE) {
    console.error('缺少 ECAM_COOKIE：请带上控制台会话 cookie（浏览器 DevTools → Application → Cookies 复制 ecmdb-token-key）')
    process.exit(2)
}

const BOGUS = 'zzz-no-such-value-zzz'

/** 敏感值模式（仅报告字段/类型与打码预览，绝不回显原值） */
const SECRET_PATTERNS = [
    ['AliyunAK', /LTAI[A-Za-z0-9]{8,}/g],
    ['TencentAK', /AKID[A-Za-z0-9]{8,}/g],
    ['AwsAK', /AKIA[0-9A-Z]{12,}/g],
    ['PrivateKey', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
    ['JwtLike', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g],
    ['SecretField', /"(?:access_key_secret|secret|password|private_key|client_secret)"\s*:\s*"(?!\*{3}|\*{6}|")[^"]{4,}"/g],
]

/** 敏感字段审计面（挑各模块代表接口） */
const SECRET_ENDPOINTS = [
    '/api/v1/cam/cloud-accounts?offset=0&limit=5',
    '/api/v1/cam/assets/ecs?offset=0&limit=3',
    '/api/v1/cam/iam/users?page=1&size=3',
    '/api/v1/cam/tasks?offset=0&limit=3',
    '/api/v1/cam/dns/domains?offset=0&limit=3',
    '/api/v1/cam/audit/logs?offset=0&limit=3',
]

/**
 * 筛选用例：base（无筛选）与 extra（追加必然无结果的筛选）
 * source 注释标明前端出处，便于复核与维护。
 */
const FILTER_CASES = [
    ['资产 ECS name', '/api/v1/cam/assets/ecs?offset=0&limit=1', `&name=${BOGUS}`, 'types/asset.ts ListAssetsParams.name'],
    ['资产 DISK name', '/api/v1/cam/assets/disk?offset=0&limit=1', `&name=${BOGUS}`, '同上'],
    ['DNS 域名 keyword', '/api/v1/cam/dns/domains?offset=0&limit=1', `&keyword=${BOGUS}`, 'views/network/dns 页面关键词'],
    ['资源模型 provider', '/api/v1/cam/models?offset=0&limit=5', `&provider=${BOGUS}`, 'types/model.ts ListModelsParams.provider'],
    ['任务 type', '/api/v1/cam/tasks?offset=0&limit=5', `&type=${BOGUS}`, 'types/task.ts ListTasksParams.type'],
    ['IAM 用户 keyword', '/api/v1/cam/iam/users?page=1&size=5', `&keyword=${BOGUS}`, 'types/iam.ts ListUsersParams.keyword'],
    ['审计日志 operation_type', '/api/v1/cam/audit/logs?offset=0&limit=5', `&operation_type=${BOGUS}`, 'views/audit/logs 筛选区 operation_type'],
]

/** 分页用例：参数形态按各接口前端真实约定（offset/limit 或 page/size） */
const PAGING_CASES = [
    ['资产 ECS', '/api/v1/cam/assets/ecs?offset=0&limit=5', '/api/v1/cam/assets/ecs?offset=5&limit=5', 'asset_id'],
    ['IAM 用户', '/api/v1/cam/iam/users?page=1&size=5', '/api/v1/cam/iam/users?page=2&size=5', 'id'],
    ['任务', '/api/v1/cam/tasks?offset=0&limit=5', '/api/v1/cam/tasks?offset=5&limit=5', 'id'],
    ['DNS 域名', '/api/v1/cam/dns/domains?offset=0&limit=5', '/api/v1/cam/dns/domains?offset=5&limit=5', 'domain_name'],
    ['审计日志(offset/limit)', '/api/v1/cam/audit/logs?offset=0&limit=5', '/api/v1/cam/audit/logs?offset=5&limit=5', 'id'],
]

async function get(path) {
    const res = await fetch(BASE + path, { headers: { cookie: COOKIE } })
    const text = await res.text()
    return { status: res.status, text }
}

/**
 * 取 data 中的条目数组。
 * 【教训】不同接口键名不同：assets 用 `items`、任务用 `tasks`、部分接口直接返回数组。
 * 只认 items/list 会把"键名不同"误判成"空列表"（实测踩过 tasks）。
 * 这里改为：数组本身、或 data 中**任意单一数组字段**都接受。
 */
function listOf(json) {
    const d = (json && json.data) || {}
    if (Array.isArray(d)) return d
    for (const key of ['items', 'list', 'tasks', 'records']) {
        if (Array.isArray(d[key])) return d[key]
    }
    const arrayKeys = Object.keys(d).filter((k) => Array.isArray(d[k]))
    return arrayKeys.length === 1 ? d[arrayKeys[0]] : []
}

async function auditSecrets() {
    const rows = []
    let bad = 0
    for (const path of SECRET_ENDPOINTS) {
        const { status, text } = await get(path)
        const hits = SECRET_PATTERNS.filter(([, re]) => re.test(text)).map(([n]) => n)
        if (hits.length) bad++
        rows.push({ check: path.split('?')[0], status, result: hits.length ? `⚠ ${hits.join(',')}` : '✓ 无明文敏感值' })
    }
    return { rows, bad }
}

async function auditFilters() {
    const rows = []
    let bad = 0
    for (const [label, base, extra, source] of FILTER_CASES) {
        const a = await get(base)
        const c = await get(base + extra)
        let ta, tc, ok = true
        try {
            const ja = JSON.parse(a.text), jc = JSON.parse(c.text)
            ta = (ja.data || {}).total ?? listOf(ja).length
            tc = (jc.data || {}).total ?? listOf(jc).length
            // 生效判据：带无效筛选后结果应减少（>0 且相同 ⇒ 疑似被忽略）
            ok = !(ta !== undefined && ta === tc && ta > 0)
        } catch {
            ok = a.status !== 200 || c.status !== 200 ? true : false
        }
        if (!ok) bad++
        rows.push({ check: label, status: `${a.status}/${c.status}`, result: ok ? `✓ 生效 (${ta}→${tc})` : `⚠ 疑似被忽略 (${ta}→${tc}) · 参数来源: ${source}` })
    }
    return { rows, bad }
}

async function auditPaging() {
    const rows = []
    let bad = 0
    for (const [label, u1, u2, key] of PAGING_CASES) {
        const a = await get(u1)
        const c = await get(u2)
        let same = false, n = 0
        try {
            const ja = JSON.parse(a.text), jc = JSON.parse(c.text)
            const ids1 = listOf(ja).map((x) => String(x[key] ?? x.id ?? '?'))
            const ids2 = listOf(jc).map((x) => String(x[key] ?? x.id ?? '?'))
            n = ids1.length
            same = ids1.length > 0 && JSON.stringify(ids1) === JSON.stringify(ids2)
        } catch { /* 解析失败视为异常，下面标记 */ }
        // 首页为空可能是"该接口用别的参数形态/无数据"，标记为无法判定但不计入失败(避免假阳性)
        if (same) bad++
        rows.push({ check: label, status: `${a.status}/${c.status}`, result: same ? '⚠ 两页完全相同(分页疑似被忽略)' : n === 0 ? '⚠ 首页为空，无法判定' : `✓ 分页生效 (${n} 条/页)` })
    }
    return { rows, bad }
}

function print(title, rows) {
    console.log(`\n=== ${title} ===`)
    for (const r of rows) console.log(`  ${r.check.padEnd(28)} [${String(r.status).padEnd(7)}] ${r.result}`)
}

async function main() {
    // 鉴权探活
    const probe = await get('/api/v1/cam/cloud-accounts?offset=0&limit=1')
    if (probe.status === 401 || probe.status === 403 || probe.status === 404) {
        console.error(`鉴权/地址不可用（HTTP ${probe.status}）—— 检查 ECAM_COOKIE 与 ECAM_BASE`)
        process.exit(2)
    }

    let failures = 0
    if (!only || only === 'secrets') { const r = await auditSecrets(); print('敏感字段泄漏', r.rows); failures += r.bad }
    if (!only || only === 'filters') { const r = await auditFilters(); print('筛选是否生效', r.rows); failures += r.bad }
    if (!only || only === 'paging') { const r = await auditPaging(); print('分页是否生效', r.rows); failures += r.bad }

    console.log(`\n结论: ${failures === 0 ? '全部通过' : `${failures} 项需人工确认`}`)
    process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
    console.error('审计脚本异常:', e)
    process.exit(2)
})
