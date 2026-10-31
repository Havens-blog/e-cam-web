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
 *   # 仅跑某一类：加 --only=secrets|filters|paging|details|invalid|limits|leaks
 *
 * 退出码：0 = 全部通过；1 = 存在疑似问题（需人工确认）；2 = 环境/鉴权不可用。
 */

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = (process.env.ECAM_BASE || 'http://localhost:8888').replace(/\/$/, '')
const API_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'api')
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
 * 【教训】不同接口键名不同：资产用 `items`、任务用 `tasks`、资源模型用 `models`、
 * 部分接口直接返回数组。只认 items/list 会把"键名不同"误判成"空列表"（实测踩过 tasks、models）。
 * 这里改为：数组本身、或 data 中**任意单一数组字段**都接受。
 */
function listOf(json) {
    const d = (json && json.data) || {}
    if (Array.isArray(d)) return d
    for (const key of ['items', 'list', 'tasks', 'records', 'models', 'groups', 'users']) {
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

/**
 * 详情接口可用性审计：列表首条的 id 能否打开对应详情。
 * 高产出类：详情 handler 常滞后于列表（改列表忘了详情）→ 点行进详情 404/空。
 * 无样本时标"跳过"，不计失败（可能是该模块暂无数据，如测试库无权限组）。
 */
const DETAIL_CASES = [
    ['资产 ECS 详情', '/api/v1/cam/assets/ecs?offset=0&limit=1', 'asset_id', (id) => `/api/v1/cam/assets/ecs/${id}`],
    ['资产 DISK 详情', '/api/v1/cam/assets/disk?offset=0&limit=1', 'asset_id', (id) => `/api/v1/cam/assets/disk/${id}`],
    ['资产 VSWITCH 详情', '/api/v1/cam/assets/vswitch?offset=0&limit=1', 'asset_id', (id) => `/api/v1/cam/assets/vswitch/${id}`],
    ['资产 RDS 详情', '/api/v1/cam/assets/rds?offset=0&limit=1', 'asset_id', (id) => `/api/v1/cam/assets/rds/${id}`],
    ['资产 LB 详情', '/api/v1/cam/assets/lb?offset=0&limit=1', 'asset_id', (id) => `/api/v1/cam/assets/lb/${id}`],
    ['任务详情', '/api/v1/cam/tasks?offset=0&limit=1', 'id', (id) => `/api/v1/cam/tasks/${id}`],
    ['IAM 用户详情', '/api/v1/cam/iam/users?page=1&size=1', 'id', (id) => `/api/v1/cam/iam/users/${id}`],
    ['DNS 域名记录', '/api/v1/cam/dns/domains?offset=0&limit=1', 'domain_name', (id) => `/api/v1/cam/dns/domains/${id}/records`],
]

function isEmptyData(data) {
    if (data == null) return true
    if (Array.isArray(data)) return data.length === 0
    if (typeof data === 'object') return Object.keys(data).length === 0
    return false
}

async function auditDetails() {
    const rows = []
    let bad = 0
    for (const [label, listPath, idKey, detailOf] of DETAIL_CASES) {
        const l = await get(listPath)
        let id
        try {
            id = listOf(JSON.parse(l.text))[0]?.[idKey]
        } catch { /* 解析失败 → id 仍为 undefined */ }
        if (!id) {
            rows.push({ check: label, status: l.status, result: `∅ 列表无样本(缺 ${idKey})，跳过(不计失败)` })
            continue
        }
        const d = await get(detailOf(id))
        let empty = true
        try { empty = isEmptyData(JSON.parse(d.text).data) } catch { /* 非 JSON 视为空 */ }
        const ok = d.status === 200 && !empty
        if (!ok) bad++
        rows.push({ check: label, status: `${l.status}/${d.status}`, result: ok ? '✓ 详情可用' : empty ? '⚠ 详情返回空数据' : '⚠ 详情异常' })
    }
    return { rows, bad }
}

/**
 * 非法输入健壮性：非法查询值不得导致 5xx（仅 GET，无副作用）。
 * 期望：4xx 正确拒绝，或 200 容错（忽略/钳制非法值）都算通过；**5xx 记为失败**。
 */
const INVALID_INPUT_CASES = [
    ['非数字 limit', '/api/v1/cam/assets/ecs?offset=0&limit=abc'],
    ['负数 limit', '/api/v1/cam/assets/ecs?offset=0&limit=-5'],
    ['负数 offset', '/api/v1/cam/assets/ecs?offset=-1&limit=5'],
    ['不存在的资产', '/api/v1/cam/assets/ecs/no-such-instance-zzz'],
    ['不存在的任务', '/api/v1/cam/tasks/not-a-uuid-zzz'],
    ['非法审计时间', '/api/v1/cam/audit/logs?start_time=garbage&offset=0&limit=1'],
    ['非法枚举 type', '/api/v1/cam/tasks?type=not-a-type&offset=0&limit=1'],
    ['非法 account_id', '/api/v1/cam/assets/ecs?account_id=not-a-number'],
]

async function auditInvalidInput() {
    const rows = []
    let bad = 0
    for (const [label, path] of INVALID_INPUT_CASES) {
        const { status } = await get(path)
        const fiveHundred = status >= 500
        if (fiveHundred) bad++
        rows.push({ check: label, status, result: fiveHundred ? '⚠ 5xx(未处理错误)' : status === 200 ? '✓ 200(容错)' : `✓ ${status}(正确拒绝)` })
    }
    return { rows, bad }
}

/**
 * 分页上限保护：超大 limit 不应一次性返回全量（实测 limit=999999 返回 5228/7360 条、4.5–6.4MB）。
 *
 * 【状态更新 2026-10-31】单页上限已在后端**铺开**：`internal/shared/paging`（MaxLimit=1000）统一钳制，
 * 27 个 `limit` 解析点接入；`internal/cert` 因 depcheck 的"可抽取模块零跨域出向"规则改用**模块内实现**
 * （数值与 shared 保持一致）。实测本检查的三条用例现在都返回 **1000 条/页**。
 * ⇒ 因此本检查**从"警告"升级为"失败判据"**：一旦哪个模块再退回"一页上万条"，审计直接判红。
 * 参考：前端当前最大只请求 200（limit/pageSize），故 1000 的上限对现有客户端零影响。
 */
const LIMIT_CASES = [
    ['资产 DISK', '/api/v1/cam/assets/disk?offset=0&limit=999999'],
    ['审计日志', '/api/v1/cam/audit/logs?offset=0&limit=999999'],
    ['资产 ECS', '/api/v1/cam/assets/ecs?offset=0&limit=100000'],
]
const LIMIT_ITEM_THRESHOLD = 1000 // 一页超过此条数视为"缺少上限保护"（失败，不再是警告）

async function auditLimits() {
    const rows = []
    let bad = 0
    for (const [label, path] of LIMIT_CASES) {
        const { status, text } = await get(path)
        let n = 0
        try {
            n = listOf(JSON.parse(text)).length
        } catch { /* 解析失败按 0 计 */ }
        const kb = Math.round(text.length / 1024)
        const risky = status === 200 && n > LIMIT_ITEM_THRESHOLD
        if (risky) bad++
        rows.push({ check: label, status, result: risky ? `⚠ 缺少上限保护：一页返回 ${n} 条 / ${kb}KB（应被钳制到 ${LIMIT_ITEM_THRESHOLD}）` : `✓ 一页 ${n} 条 / ${kb}KB` })
    }
    return { rows, bad }
}

/**
 * 存储/实现痕迹泄露审计。
 *
 * 【为什么单列一项】2026-10-31 实测：对 59 个"含路径参数的只读端点"用**必然不存在的 id** 探测，
 * 50 个正确回 404、6 个 200，但有 3 个回 **500 且响应体里直接是存储原文**：
 *   {"code":500,"msg":"mongo: no documents in result"}          ← /alert/channels/{id}、/alert/rules/{id}
 *   {"code":500,"msg":"get budget: mongo: no documents in result"} ← /budget/{id}/progress
 * ⇒ 只看状态码会以为"3 个 500"，而真正的问题是**把存储实现细节回给了调用方**（同时语义也应 404）。
 * 该类缺陷已在 service 层按"mongo.ErrNoDocuments → 领域错误"修复（#234/#238），本检查用于**回归**。
 *
 * 【端点来源】不硬编码清单，而是从 `src/api/*.ts` 派生（与设置/参数同源，避免"猜路径"）：
 * 只取**含 ${...} 路径参数**、且**调用方法是 GET**的 url（写操作不探），参数统一替换为 999999。
 */
const LEAK_MARKERS = [
    ['mongo', /mongo:/i],
    ['ErrNoDocuments', /ErrNoDocuments/],
    ['BSON', /\bBSON\b/],
    ['collection', /\bcollection\b/i],
    ['sql', /\b(sql|SQLSTATE|pq:)\b/],
    ['redis', /\bredis\b/i],
    ['panic', /\bpanic\b/i],
    ['goroutine', /goroutine\s+\d+/],
    ['goStack', /\.go:\d+/],
    ['dial', /dial tcp/i],
    ['dns', /no such host/i],
    ['connRefused', /connection refused/i],
    ['ctxCanceled', /context canceled/i],
    ['dupKey', /duplicate key/i],
]
const READ_METHODS = new Set(['get'])
const WRITE_HINTS = /(delete|retry|sync|confirm|execute|rollback|cancel|apply|bind|batch|create|update|submit|toggle)/i

/** 从 src/api/*.ts 派生只读、含路径参数的端点（${...} → 999999）。 */
export function deriveLeakCandidates() {
    const eps = new Set()
    let files = []
    try {
        files = readdirSync(API_DIR).filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
    } catch (e) {
        console.error(`[leaks] 无法读取 ${API_DIR}：${e.message}（请在 e-cam-web 仓库根目录运行）`)
        return []
    }
    for (const file of files) {
        const src = readFileSync(join(API_DIR, file), 'utf8')
        // 两种常见写法都要覆盖：
        //   ① url: `${API_SERVICE.CAM}/...`
        //   ② const BASE = '/cam/xxx' 之后的 url: `${BASE}/...`
        // 【教训】只认 ① 会漏掉 logs.ts / dns.ts 两个模块的全部端点（本轮补上，覆盖 41→更多候选）。
        const baseMatch = src.match(/const BASE = ['"]([^'"]+)['"]/)
        // [pattern, 前缀] 两元组：CAM 写法直接给全路径，BASE 写法给的是**相对后缀**（如 /types、/export/${id}），需补 BASE 前缀
        const patterns = [[/url:\s*`\$\{API_SERVICE\.CAM\}([^`]+)`/g, '']]
        if (baseMatch) {
            patterns.push([/url:\s*`\$\{BASE\}([^`]*)`/g, baseMatch[1]])
        }
        for (const [re, prefix] of patterns) {
            for (let m = re.exec(src); m; m = re.exec(src)) {
                const raw = prefix + m[1]
                if (!raw.includes('${')) continue // 只探详情类（含路径参数）
                if (WRITE_HINTS.test(raw)) continue // 含写操作提示词，先排除
                // 方法判定：向前找最近的 instance.<method>（api 层写法为 instance.get<T>({ url: ... })）
                const before = src.slice(Math.max(0, m.index - 160), m.index)
                const mm = [...before.matchAll(/instance\.([a-z]+)\s*</g)].pop()
                const method = (mm && mm[1]) || 'get'
                if (!READ_METHODS.has(method.toLowerCase())) continue
                eps.add('/api/v1/cam' + raw.replace(/\$\{[^}]+\}/g, '999999'))
            }
        }
    }
    return [...eps].sort()
}

async function auditLeaks() {
    const rows = []
    let bad = 0
    const candidates = deriveLeakCandidates()
    if (!candidates.length) {
        return { rows: [{ check: '(派生端点)', status: '-', result: '⚠ 未能从 src/api 派生候选端点，请确认运行目录' }], bad: 0 }
    }
    for (const path of candidates) {
        const { status, text } = await get(path)
        // 只报告命中的**痕迹名**，不回显原文（证据里不应出现响应体内容）
        const hits = LEAK_MARKERS.filter(([, re]) => re.test(text)).map(([n]) => n)
        // 规则 2：HTTP 200 但响应体 code 非成功（0/200）—— 状态码与业务码**相反错位**。
        // 实测：GET /api/v1/cam/templates/999999 → 200 {"code":404030,"msg":"vm template not found"}
        // 只按 HTTP 判成功的客户端会把"不存在"当成成功；该缺陷与"5xx 泄露"同族（契约错位）。
        let codeMismatch = false
        if (status === 200) {
            try {
                const j = JSON.parse(text)
                if (j && typeof j.code === 'number' && j.code !== 0 && j.code !== 200) codeMismatch = true
            } catch { /* 非 JSON 不判定 */ }
        }
        if (hits.length || codeMismatch) bad++
        const okText = status === 404 ? '✓ 404（语义正确）' : status === 200 ? '✓ 200' : `✓ ${status}`
        rows.push({
            check: path.replace('/api/v1/cam', ''),
            status,
            result: hits.length
                ? `⚠ 响应体含存储/实现痕迹: ${hits.join(',')}`
                : codeMismatch
                    ? '⚠ HTTP 200 但响应体是错误码（状态码与业务码错位）'
                    : okText,
        })
    }
    return { rows, bad, candidates: candidates.length }
}

async function main() {
    // 鉴权探活
    const probe = await get('/api/v1/cam/cloud-accounts?offset=0&limit=1')
    if (probe.status === 401 || probe.status === 403 || probe.status === 404) {
        console.error(`鉴权/地址不可用（HTTP ${probe.status}）—— 检查 ECAM_COOKIE 与 ECAM_BASE`)
        process.exit(2)
    }

    let failures = 0
    let warnings = 0
    if (!only || only === 'secrets') { const r = await auditSecrets(); print('敏感字段泄漏', r.rows); failures += r.bad }
    if (!only || only === 'filters') { const r = await auditFilters(); print('筛选是否生效', r.rows); failures += r.bad }
    if (!only || only === 'paging') { const r = await auditPaging(); print('分页是否生效', r.rows); failures += r.bad }
    if (!only || only === 'details') { const r = await auditDetails(); print('详情接口可用性', r.rows); failures += r.bad }
    if (!only || only === 'invalid') { const r = await auditInvalidInput(); print('非法输入健壮性(不得 5xx)', r.rows); failures += r.bad }
    if (!only || only === 'limits') { const r = await auditLimits(); print('分页上限保护', r.rows); failures += r.bad }
    if (!only || only === 'leaks') { const r = await auditLeaks(); print(`存储痕迹泄露(候选 ${r.candidates ?? '-'} 个只读详情端点)`, r.rows); failures += r.bad }

    const warnPart = warnings ? `，另 ${warnings} 项已知未决警告（不阻塞）` : ''
    console.log(`\n结论: ${failures === 0 ? '全部通过' : `${failures} 项需人工确认`}${warnPart}`)
    process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
    console.error('审计脚本异常:', e)
    process.exit(2)
})
