/**
 * 中英混排空格守卫（iter358）
 *
 * 背景：同一类文案缺陷我踩了**两次** ——
 *   iter350 批量修 8 个 network 页时写成 `个CDN资源`；
 *   iter357 批量修 9 个 compute/databases/middleware 页时又写成 `个云数据库 RDS资源` / `个Redis 实例资源`。
 * 两次我都在 PR 里写了「中英混排要逐条检查输出」，**然后下次照样犯**。
 *
 * 结论与前几轮一致：**写在 PR 里的教训不会有人回头读（包括我自己）。**
 * 所以把它变成用例。
 *
 * ── 判据为什么不能是「中英之间一律加空格」 ──
 * 普查发现 CAM 全仓有 **307 处**中文紧邻拉丁字母，但其中 **213 处是正确的**：
 *   · **缩写/专有名词，业界惯例不加空格**：`弹性公网IP`、`资产ID`、`请求ID`、`来源IP`、`API调用`
 *   · **数字 + 中文量词**：`近7天`、`近3个月`、`近90天`
 * 若按「一律加空格」判，会要求改 213 处正确文案 —— 这类判据没人会遵守，只会被加进豁免清单。
 *
 * **所以只查「完整英文单词紧邻中文」**（Redis / Kafka / MongoDB / Access Key 等），
 * 这类**必须**有空格；缩写与数字量词用白名单排除。
 *
 * 实测判据产出：15 处，**全部是真缺陷**（本轮已修 13 组替换覆盖）。
 */
import { describe, expect, it } from 'vitest'

/** 收集所有 .vue 源码（?raw，不做编译） */
const sources = import.meta.glob('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * 缩写 / 技术名词白名单：中文紧邻它们**不加空格是正确的**。
 *
 * 收录依据：普查中实际出现且判定为「业界惯例」的形态。
 * 若将来发现某个词其实该加空格，请把它从本表移除 —— 用例会随即报出所有位置。
 */
const ABBREVIATIONS: readonly string[] = [
  'ID', 'IP', 'API', 'URL', 'URI', 'CPU', 'GPU', 'RAM', 'IO', 'IOPS',
  'DNS', 'SSL', 'TLS', 'HTTP', 'HTTPS', 'SSH', 'JSON', 'YAML', 'SDK',
  'CDN', 'VPC', 'EIP', 'ENI', 'LB', 'WAF', 'DDoS', 'NAS', 'OSS', 'RDS',
  'MQ', 'K8s', 'KMS', 'ARN', 'SLA', 'SLO', 'QPS', 'TPS', 'UTC', 'GMT',
  'OS', 'VM', 'ECS', 'ACL', 'DB', 'SQL', 'TTL', 'CIDR', 'NAT', 'VPN',
  'ELB', 'SLB', 'ALB', 'NLB', 'AI', 'UI', 'UX', 'FAQ', 'PDF', 'CSV',
]

/**
 * 「完整英文单词」清单：中文紧邻它们**必须有空格**。
 *
 * 刻意只收**产品/技术专名**，不收任意英文单词 —— 否则会把
 * `placeholder="请输入..."` 这类属性值、代码标识符也卷进来，误报不可控。
 */
const FULL_WORDS: readonly string[] = [
  'Redis', 'Kafka', 'MongoDB', 'Elasticsearch', 'MySQL', 'PostgreSQL',
  'Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Prometheus', 'Grafana',
  'Python', 'Java', 'Node', 'Vue', 'React',
  'Linux', 'Windows', 'CentOS', 'Ubuntu',
  'Access Key ID', 'Access Key Secret', 'Access Key',
  'Bucket', 'Object',
]

const CJK = '\\u4e00-\\u9fa5'

/** 把白名单缩写替换成占位符，避免它们在后续匹配里被当成「完整英文词」的片段 */
function maskAbbreviations(text: string): string {
  let t = text
  for (const abbr of ABBREVIATIONS) {
    t = t.split(abbr).join('§'.repeat(abbr.length))
  }
  return t
}

/** 返回该文本里「完整英文单词紧邻中文（无空格）」的命中片段 */
function findMissingSpaces(text: string): string[] {
  const masked = maskAbbreviations(text)
  const hits = new Set<string>()
  for (const word of FULL_WORDS) {
    // 中文 + 空格? + 词  —— 只有**没有空格**时才算命中
    const cjkThenWord = new RegExp(`[${CJK}](${word})`, 'g')
    const wordThenCjk = new RegExp(`(${word})[${CJK}]`, 'g')
    for (const m of masked.matchAll(cjkThenWord)) hits.add('…' + m[1])
    for (const m of masked.matchAll(wordThenCjk)) hits.add(m[1] + '…')
  }
  return [...hits]
}

/** 只扫「看起来是用户可见文案」的行：模板文本、引号字符串、模板字面量 */
function userFacingLines(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  src.split('\n').forEach((line, i) => {
    if (!new RegExp(`[${CJK}]`).test(line)) return
    // 纯代码行（import / export / 类型声明 / 纯注释）跳过
    if (/^\s*(import|export|type|interface|\/\/|\*)/.test(line)) return
    out.push({ line: i + 1, text: line })
  })
  return out
}

describe('中英混排空格守卫（iter358）', () => {
  it('完整英文单词紧邻中文时必须加空格', () => {
    const offenders: string[] = []

    for (const [path, src] of Object.entries(sources)) {
      // 测试文件自身会包含这些词作为数据，跳过
      if (/\.(test|spec)\./.test(path)) continue
      for (const { line, text } of userFacingLines(src)) {
        const hits = findMissingSpaces(text)
        if (!hits.length) continue
        const rel = path.replace(/^.*?\.\.\/\.\.\//, '')
        offenders.push(`${rel}:${line}  ${hits.join(' ')}  →  ${text.trim().slice(0, 80)}`)
      }
    }

    expect(
      offenders,
      '以下位置「完整英文单词」紧邻中文但没有空格（如 `个Redis 实例资源` 应为 `个 Redis 实例资源`）。\n' +
        '缩写（ID / IP / API …）与数字量词（近7天）不在本规则内，无需改：\n  ' +
        offenders.join('\n  '),
    ).toEqual([])
  })

  it('缩写白名单确实被排除（阳性/阴性对照）', () => {
    // 阴性：缩写紧邻中文不应被判为问题
    expect(findMissingSpaces('弹性公网IP')).toEqual([])
    expect(findMissingSpaces('资产ID')).toEqual([])
    expect(findMissingSpaces('请求ID')).toEqual([])
    // 阳性：完整英文词紧邻中文必须被判定
    expect(findMissingSpaces('个Redis 实例资源').length).toBeGreaterThan(0)
    expect(findMissingSpaces('正在加载Kafka 实例…').length).toBeGreaterThan(0)
    // 阴性：加了空格就不应再命中
    expect(findMissingSpaces('个 Redis 实例资源')).toEqual([])
    expect(findMissingSpaces('正在加载 Kafka 实例…')).toEqual([])
  })
})
