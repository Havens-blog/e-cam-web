import { describe, expect, it } from 'vitest'
import {
    LAST_BATCH_STORAGE_KEY,
    batchProgressPercent,
    batchResultMeta,
    canDeleteRow,
    daysLeftBadge,
    deleteBlockedSummary,
    expectedDomainCovered,
    extractPemDomains,
    foldSans,
    formatPercent,
    hostingStatusMeta,
    importErrorItems,
    isBatchTerminal,
    loadLastBatchId,
    materialIssueMeta,
    pairBaseName,
    protectDaysLeft,
    resolvePageState,
    saveLastBatchId,
    sniffPemKind,
    splitZipEntries,
    truncateFingerprint,
} from './format'

// ==================== AC2：表格展示逻辑 ====================

describe('truncateFingerprint（指纹 mono 截断 首尾 8 字符，AC2）', () => {
    it('SHA256 hex 长指纹截断为 首8…末8', () => {
        const fp = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
        expect(truncateFingerprint(fp)).toBe('a1b2c3d4…c6d7e8f90'.slice(0, 8) + '…' + fp.slice(-8))
        expect(truncateFingerprint(fp)).toHaveLength(8 + 1 + 8)
    })

    it('短指纹原样返回（不强行截断）', () => {
        expect(truncateFingerprint('abcd1234')).toBe('abcd1234')
        expect(truncateFingerprint('')).toBe('')
    })
})

describe('daysLeftBadge（剩余天数状态色：>30 Success / ≤30·≤14 Warning / ≤7·过期 Error，AC2）', () => {
    it('>30 天 → success + ✓', () => {
        expect(daysLeftBadge(74)).toMatchObject({ text: '74 天', tone: 'success' })
    })
    it('≤30 天 → warning', () => {
        expect(daysLeftBadge(30)).toMatchObject({ tone: 'warning' })
        expect(daysLeftBadge(20)).toMatchObject({ tone: 'warning' })
    })
    it('≤14 天 → warning（文案不变，色阶加深由样式层处理）', () => {
        expect(daysLeftBadge(14)).toMatchObject({ tone: 'warning' })
        expect(daysLeftBadge(8)).toMatchObject({ tone: 'warning' })
    })
    it('≤7 天 → error', () => {
        expect(daysLeftBadge(7)).toMatchObject({ tone: 'error' })
        expect(daysLeftBadge(1)).toMatchObject({ tone: 'error' })
    })
    it('已过期 → error + 「已过期 N 天」文案', () => {
        expect(daysLeftBadge(0)).toMatchObject({ text: '已过期 0 天', tone: 'error' })
        expect(daysLeftBadge(-2)).toMatchObject({ text: '已过期 2 天', tone: 'error' })
    })
})

describe('hostingStatusMeta（托管状态徽章，AC2）', () => {
    it('complete → 完整托管 accent', () => {
        expect(hostingStatusMeta('complete')).toEqual({ label: '完整托管', tone: 'accent' })
    })
    it('fingerprint_only → 仅指纹登记 secondary', () => {
        expect(hostingStatusMeta('fingerprint_only')).toEqual({ label: '仅指纹登记', tone: 'secondary' })
    })
})

describe('protectDaysLeft（保护期锁徽章，AC2/AC5）', () => {
    const now = new Date('2026-08-19T00:00:00Z')
    it('保护期未来 → 向上取整天数', () => {
        expect(protectDaysLeft('2026-08-24T00:00:00Z', now)).toBe(5)
        expect(protectDaysLeft('2026-08-19T13:00:00Z', now)).toBe(1)
    })
    it('已过期 / null / 非法值 → 0（列显示 —）', () => {
        expect(protectDaysLeft('2026-08-18T00:00:00Z', now)).toBe(0)
        expect(protectDaysLeft(null, now)).toBe(0)
        expect(protectDaysLeft(undefined, now)).toBe(0)
        expect(protectDaysLeft('not-a-date', now)).toBe(0)
    })
})

describe('foldSans（SAN chips 超 3 个折叠 +N，AC2）', () => {
    it('≤3 个全部展示', () => {
        expect(foldSans(['a.com', 'b.com', 'c.com'])).toMatchObject({
            visible: ['a.com', 'b.com', 'c.com'],
            hiddenCount: 0,
            folded: false,
        })
    })
    it('>3 个折叠为首 3 个 + 剩余计数', () => {
        const r = foldSans(['a.com', 'b.com', 'c.com', 'd.com', 'e.com'])
        expect(r.visible).toEqual(['a.com', 'b.com', 'c.com'])
        expect(r.hiddenCount).toBe(2)
        expect(r.folded).toBe(true)
    })
})

// ==================== AC1：统计卡 ====================

describe('formatPercent（覆盖率/占比双口径，AC1）', () => {
    it('小数比率（0~1）转百分比整数', () => {
        expect(formatPercent(0.907)).toBe('91%')
        expect(formatPercent(0.3)).toBe('30%')
        expect(formatPercent(1)).toBe('100%')
        expect(formatPercent(0)).toBe('0%')
    })
    it('非法/缺失值显示占位符而非误导性 0%', () => {
        expect(formatPercent(Number.NaN)).toBe('—')
        expect(formatPercent(undefined as unknown as number)).toBe('—')
    })
})

// ==================== AC3：导入 Modal ====================

describe('importErrorItems（四类 CERT_* 校验错误映射，AC3）', () => {
    it('四类错误码各自映射为明确文案', () => {
        for (const [code, label] of [
            ['CERT_KEY_MISMATCH', '私钥不匹配'],
            ['CERT_CHAIN_INCOMPLETE', '证书链缺失'],
            ['CERT_PARSE_FAIL', 'SAN 结构无法解析 / 已过期'],
            ['CERT_DUPLICATE_FINGERPRINT', '重复指纹'],
        ] as const) {
            const items = importErrorItems({ code, message: 'server detail' })
            expect(items).toHaveLength(1)
            expect(items[0]).toMatchObject({ code, label, detail: 'server detail' })
        }
    })
    it('未知错误码回退为通用文案并保留服务端消息', () => {
        const items = importErrorItems({ code: 'SOMETHING_ELSE', message: 'boom' })
        expect(items).toHaveLength(1)
        expect(items[0]?.label).toBe('导入失败')
        expect(items[0]?.detail).toBe('boom')
    })
    it('非结构化错误 → 通用条目', () => {
        const items = importErrorItems(new Error('Network Error'))
        expect(items).toHaveLength(1)
        expect(items[0]?.label).toBe('导入失败')
    })
})

describe('extractPemDomains + expectedDomainCovered（预期域名提示性比对，AC3）', () => {
    // 构造最小 PEM：base64 载荷内嵌 DER 风格 ASCII 域名串（SAN/CN 为 IA5String 原文出现）
    function fakePem(domains: string[]): string {
        const body = domains.map((d) => `\x17\x0d${String.fromCharCode(d.length)}${d}`).join('')
        return `-----BEGIN CERTIFICATE-----\n${btoa(body)}\n-----END CERTIFICATE-----`
    }

    it('从 PEM 提取嵌入的域名串', () => {
        expect(extractPemDomains(fakePem(['*.example.com', 'api.example.com']))).toEqual([
            '*.example.com',
            'api.example.com',
        ])
    })

    it('精确命中', () => {
        expect(expectedDomainCovered('api.example.com', ['api.example.com', 'b.com'])).toBe(true)
    })
    it('通配符 SAN 覆盖子域名', () => {
        expect(expectedDomainCovered('shop.example.com', ['*.example.com'])).toBe(true)
    })
    it('未覆盖 → false（触发 Warning 提示，不拦截提交）', () => {
        expect(expectedDomainCovered('other.example.com', ['*.api.example.com'])).toBe(false)
        expect(expectedDomainCovered('a.com', ['b.com'])).toBe(false)
    })
    it('大小写与结尾点号归一', () => {
        expect(expectedDomainCovered('API.example.com.', ['api.example.com'])).toBe(true)
    })
})

// ==================== AC5：删除拦截 ====================

describe('deleteBlockedSummary（拦截原因：N 个引用 / 保护期至 X 日，AC5）', () => {
    it('引用数 + 保护期组合为一句说明', () => {
        expect(
            deleteBlockedSummary({ refCount: 12, protectUntil: '2026-08-25T00:00:00Z', now: new Date('2026-08-19T00:00:00Z') }),
        ).toBe('12 个活跃引用 · 回滚保护期至 2026-08-25')
    })
    it('仅引用数', () => {
        expect(deleteBlockedSummary({ refCount: 3, now: new Date() })).toBe('3 个活跃引用')
    })
    it('盲区拦截沿用服务端 reason', () => {
        expect(
            deleteBlockedSummary({ referenceStatus: 'blind_spot', refCount: 0, reason: '扫描未覆盖该证书涉及的云/产品' }),
        ).toBe('扫描未覆盖该证书涉及的云/产品')
    })
    it('无结构化信息时回退通用文案', () => {
        expect(deleteBlockedSummary(null)).toBe('存在活跃引用或处于回滚保护期，禁止删除')
    })
})

describe('canDeleteRow（行级预判：引用/保护期 → 拦截 Modal 而非确认 Modal，AC5）', () => {
    const now = new Date('2026-08-19T00:00:00Z')
    it('有引用或保护期内不可删（直接拦截）', () => {
        expect(canDeleteRow({ refCount: 12, protectUntil: null }, now)).toBe(false)
        expect(canDeleteRow({ refCount: 0, protectUntil: '2026-08-24T00:00:00Z' }, now)).toBe(false)
    })
    it('无引用且不在保护期 → 走二次确认', () => {
        expect(canDeleteRow({ refCount: 0, protectUntil: null }, now)).toBe(true)
        expect(canDeleteRow({ refCount: 0, protectUntil: '2026-08-01T00:00:00Z' }, now)).toBe(true)
    })
})

// ==================== AC4：批量导入 ====================

describe('isBatchTerminal + batchProgressPercent（轮询终态与进度，AC4）', () => {
    it('completed / partial_failed 为终态', () => {
        expect(isBatchTerminal('completed')).toBe(true)
        expect(isBatchTerminal('partial_failed')).toBe(true)
        expect(isBatchTerminal('running')).toBe(false)
    })
    it('进度百分比 = done/total 且钳制 0~100', () => {
        expect(batchProgressPercent(2, 4)).toBe(50)
        expect(batchProgressPercent(0, 0)).toBe(0)
        expect(batchProgressPercent(5, 4)).toBe(100)
    })
})

describe('pairBaseName（逐文件私钥按去扩展���基名配对，AC4）', () => {
    it('证书与私钥以去扩展名基名配对', () => {
        expect(pairBaseName('shop.example.com.pem')).toBe('shop.example.com')
        expect(pairBaseName('shop.example.com.key')).toBe('shop.example.com')
        expect(pairBaseName('a/b/c.crt')).toBe('c')
        expect(pairBaseName('noext')).toBe('noext')
    })
})

describe('sniffPemKind + splitZipEntries（zip 解包：证书/私钥分流，AC4）', () => {
    const certPem = () => new TextEncoder().encode('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----')
    const keyPem = () => new TextEncoder().encode('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----')

    it('.pem 扩展名按内容嗅探区分证书/私钥', () => {
        expect(sniffPemKind('a.pem', certPem())).toBe('cert')
        expect(sniffPemKind('a.pem', keyPem())).toBe('key')
        expect(sniffPemKind('a.crt', keyPem())).toBe('cert') // 扩展名优先于内容
        expect(sniffPemKind('a.key', certPem())).toBe('key')
    })

    it('zip 条目分流为证书与私钥，跳过目录与杂物', () => {
        const r = splitZipEntries({
            'certs/a.pem': certPem(),
            'certs/b.pem': keyPem(),
            'certs/c.crt': certPem(),
            '__MACOSX/junk': certPem(),
            'readme.txt': certPem(),
        })
        expect(r.certs.map((c) => c.name)).toEqual(['certs/a.pem', 'certs/c.crt'])
        expect(r.keys.map((k) => k.name)).toEqual(['certs/b.pem'])
    })
})

describe('batchResultMeta（逐文件结果徽章文案，AC4）', () => {
    it('成功（完整托管）/ 成功（仅指纹登记）/ 失败', () => {
        expect(batchResultMeta('complete').label).toBe('成功 · 完整托管')
        expect(batchResultMeta('fingerprintOnly').label).toBe('成功 · 仅指纹登记')
        expect(batchResultMeta('failed').label).toBe('失败')
    })
})

describe('会话恢复持久化（中断重入展示上次会话，AC4）', () => {
    function memoryStorage(): Storage {
        const m = new Map<string, string>()
        return {
            getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
            setItem: (k: string, v: string) => void m.set(k, v),
            removeItem: (k: string) => void m.delete(k),
            clear: () => m.clear(),
            key: () => null,
            get length() {
                return m.size
            },
        }
    }

    it('保存/读取/清除上次 batchId', () => {
        const s = memoryStorage()
        expect(loadLastBatchId(s)).toBeNull()
        saveLastBatchId('abc123', s)
        expect(loadLastBatchId(s)).toBe('abc123')
        expect(s.getItem(LAST_BATCH_STORAGE_KEY)).toBe('abc123')
        saveLastBatchId(null, s)
        expect(loadLastBatchId(s)).toBeNull()
    })

    it('storage 不可用（隐私模式等）不抛错，静默返回 null', () => {
        const broken = {
            getItem: () => {
                throw new Error('denied')
            },
        } as unknown as Storage
        expect(loadLastBatchId(broken)).toBeNull()
        expect(() => saveLastBatchId('x', broken)).not.toThrow()
    })
})

// ==================== AC6：四态 ====================

describe('resolvePageState（loading/empty/error/populated 四态判定，AC6）', () => {
    it('loading 优先，其次 error，total=0 → empty', () => {
        expect(resolvePageState({ loading: true, error: false, total: 5 })).toBe('loading')
        expect(resolvePageState({ loading: false, error: true, total: 0 })).toBe('error')
        expect(resolvePageState({ loading: false, error: false, total: 0 })).toBe('empty')
        expect(resolvePageState({ loading: false, error: false, total: 60 })).toBe('populated')
    })
    it('error 但已有数据（刷新失败）维持 populated 避免整页塌陷', () => {
        expect(resolvePageState({ loading: false, error: true, total: 60 })).toBe('populated')
    })
})

// ==================== 材料异常徽章（盘点容忍标记） ====================

describe('materialIssueMeta', () => {
    it('expired 映射 error 徽章', () => {
        expect(materialIssueMeta('expired')).toEqual({ label: '材料异常：已过期', tone: 'error' })
    })

    it('chain_incomplete 映射 warning 徽章', () => {
        expect(materialIssueMeta('chain_incomplete')).toEqual({ label: '材料异常：链不完整', tone: 'warning' })
    })

    it('缺省/未知值为 null（正常证书不渲染徽章）', () => {
        expect(materialIssueMeta(undefined)).toBeNull()
        expect(materialIssueMeta('')).toBeNull()
        expect(materialIssueMeta('weird')).toBeNull()
    })
})
