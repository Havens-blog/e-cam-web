# 已知乱码残留清单（known mojibake）

本文件记录三仓（`e-cam-web` / `haven-console` / `opsagent-web`）文本文件中**仍然存在的 U+FFFD 乱码**，
以及已按证据修复的部分，由编码治理专项建立。

> **注意**：本文件为实现"逐条标注"而原样引用了乱码文本，因此**自身含 47 行 U+FFFD**。
> 做全仓扫描（如 `git grep -P '\x{FFFD}'`）时请排除本文件，否则会把"标注"误计为"残留"。
> 排除本文件后的准确口径：
> - **版本库内真实残留 42 行** = `cmdb.yaml` 34 + 源码 8；
> - 连同被 gitignore 的本地文件（历史文档 11 + `.claude` 备份 2）共 **55 行**。
>
> 另需注意：二进制资源（`src/assets/iconfont/iconfont.{ttf,woff,woff2}`、PNG/JPG 等）
> 中同样能搜到 U+FFFD，那是**解码失败字节，不是乱码**，一律不计入统计。
> （这一点会误导扫描：用 PowerShell `Get-Content -Encoding utf8` 读 PNG 就会报出"乱码行"。）

## 结论速览

| 分类 | 修复前 | 已按证据修复 | 仍然残留 | 处置 |
| --- | ---: | ---: | ---: | --- |
| `e-cam-web/cmdb.yaml` | 114 行 | **80 行** | 34 行 | 残留只标注，见 §1 |
| 源码 / 测试 / 样式注释 | 30 行 | **22 行** | 8 行 | 残留只标注，见 §2 |
| 历史文档 `.superpowers/sdd/**`、`docs/superpowers/plans/**` | 11 行 | 0 | 11 行 | **按约定一律不改**，见 §3 |
| `.claude/backups/**`（已被 gitignore，不入库） | 2 行 | 0 | 2 行 | 见 §4 |
| `e-cmdb-web/src/api/cmdb.ts`（范围外，本轮一并治理） | 21 行 | **21 行** | 0 | 整行照抄拆分前修订，见 §5 |

合计（三仓）157 行 → 修复 102 行 → 残留 55 行，其中 **42 行在版本库内**（`cmdb.yaml` 34 + 源码 8），
另 13 行位于被 gitignore 的本地文件中。范围外的 `e-cmdb-web` 另行治理：21 行恢复、0 残留。

## 两种互不相同的损坏形态

识别这一点的价值在于：**不能假设"丢了几个字"**。

1. `cmdb.yaml`：`<一个汉字>` → `U+FFFD` + `?`。
   已验证每个 `U+FFFD?` 恰好对应**一个**丢失的汉字（例：`模型属性管�?` ← `模型属性管理`）。
2. 源码 / 测试注释：`<一个汉字>` → **连续 2–3 个 `U+FFFD`**。
   字符数**与 U+FFFD 个数不成比例**：`进入向导恢复���` 实际丢了 `编辑` 两个字，
   `内部重新拉���` 只丢 `取` 一个字。因此**任何"按字节数推算字数"的自动补全都会静默截断**，
   本文档中所有补全都要求"补全后的词在仓内存在完好出处"，而不是按字节数猜。

## 修复判定标准（可复核）

一行乱码被修改，必须满足以下三条之一：

- **A｜语料证据**：补全后的词/短语在**同仓**其他文件的完好行中逐字存在
  （例：`（零硬编码色）` 见 `DetailDrawer/index.vue:12`、`FilterBar/index.vue:91`、`StateBlock/index.vue:45`）。
- **B｜整块括号结构**：把该行所在的**整个注释块**（跨行 JSDoc / `<!-- -->` / 单行 `//`）
  作为整体统计全角括号，若多出一个 `（` 或 `）`，则缺口即为配对括号。
  例：`permission.ts` 的 L68–77 注释块多一个 `）` → 补 `（`。
- **C｜补全后必须让整块括号配平**：凡会破坏配平的候选一律否决。

被否决的典型假阳性（供后来者警惕，这类匹配来自"同一注释的另一个修订版"或无关句子）：

| 目标 | 工具给出的错误候选 | 假证据来源 | 真相 |
| --- | --- | --- | --- |
| `ChangeTable.vue:167` 的 `行��` | `、` | 某 cert 任务 md 表格里的 `行、Testing` | 应为一个汉字，故**不修** |
| `cert/detail/format.ts:85` 的 `故���用` | `优先` | `haven-console/Workbench.vue:694` 的 `故优先用趋势数据`（跨仓、无关） | 未定，**不修** |
| `format.ts:110` 的 `向导恢复���` | `）` | 整块结构判据（本行确实多一个 `（`） | 语料证据更强 → 补 `编辑` |
| `DataTable/index.vue:232` | `取）` | `views/dev/ui-kit/index.vue:419` 的 `组件内部重新拉取）` | 补 `）` 会破坏本行配平 → 只补 `取` |

## §1 `cmdb.yaml` 残留 34 行（只标注，不改）

该文件为 OpenAPI 规格文档（仓库根 `cmdb.yaml`，全仓无代码引用）。
80 行已由 `e-cam-service/docs/api/cmdb.yaml` 等亲缘规格逐行比对修复；以下 34 行
**在全部源池（14 万行，含 8 个目录）中找不到唯一命中的完好行**，故保持原样。

表格中 `**粗体**` 为建议补全（保守推断，仅供人工确认）。

| 行 | 当前内容 | 建议补全 |
| ---: | --- | --- |
| 63 | `description: 云厂商标�?(aliyun, aws, azure)` | 云厂商标**识** |
| 78 | `description: 层级 (1=主资�? 2=子资�?` | 主资**源**, 2=子资**源** |
| 133 | `description: 更新指定模型的信�?` | 信**息** |
| 234 | `用于前端树形展�?` | 展**示** |
| 253 | `description: 初始化成�?` | 成**功** |
| 302 | `…有模型的分组不可删除�?` | 不可删除**）** |
| 633 | `description: 删除属性分组（内置分组不可删除�?` | 不可删除**）** |
| 677 | `description: 实例已存�?` | 已存**在** |
| 683 | `description: 获取资源实例列表，支持多种过滤条�?` | 条**件** |
| 688 | `description: 模型UID (�?aliyun_ecs, aws_ec2)` | **(如:** / **(例:** |
| 709 | `description: 状�?(Running, Stopped�?` | 状**态** (Running, Stopped**)** |
| 763 | `…适用于资源同步场�?` | 场**景** |
| 829 | `description: 更新指定实例的信�?` | 信**息** |
| 1025 | `description: 关系已存�?` | 已存**在** |
| 1110 | `description: 关系不存�?` | 不存**在** |
| 1269 | `description: 层级 (1=主资�? 2=子资�?` | 同 L78 |
| 1425 / 1468 | `example: 云资�?` | 云资**产** |
| 1569 | `# ==== 属性相�?Schema ====` | 属性相**关** Schema |
| 1575 | `description: 字段类型�?` | 字段类型**：** |
| 1660 | `description: 选项�?JSON格式，用于enum类型)` | 选项**（**JSON格式…） |
| 1664 / 1721 / 1791 | `description: 默认�?` | 默认**值：** |
| 1718 / 1788 | `description: 选项�?JSON格式)` | 选项**（**JSON格式） |
| 1839 | `# ==== 属性分组相�?Schema ====` | 属性分组相**关** Schema |
| 2079 | `动态属�?(会与现有属性合�?` | 动态属**性** (…合**并**) |
| 2165 | `description: 创建的实例数�?` | 数**量** |
| 2238 | `description: 源到目标的描�?` | 描**述** |
| 2242 | `description: 目标到源的描�?` | 描**述** |
| 2546 / 2571 | `description: 模型拓扑�?` | 拓扑**图** |
| 2580 | `description: 模型关系边列�?` | 边列**表** |

## §2 源码 / 测试 / 样式残留 8 行（只标注，不改）

均为注释或测试名，**不影响运行时行为**；因源池中不存在唯一完好的对应短语，未改动。

| 位置 | 当前内容 | 候选 |
| --- | --- | --- |
| `src/api/request/cert.ts:8` | `* ��端统一信封为 {success, data, error, meta}…` | 后**端** / 服务**端** |
| `src/components/__tests__/PageContainer.test.ts:7` | `* attrs 透传保���、title 属性透传语义…` | 保**留** / 保**持** |
| `src/views/cert/changes/components/ChangeTable.vue:167` | `// 表体/hover 行�� Text Secondary 对比度提升…` | 行**内** / 行**文字** |
| `src/views/cert/changes/format.ts:517` | `/** 倒计时���示：23:59:59；…reduced-motion…*/` | 倒计时**显示** / 倒计时**演示** |
| `src/views/cert/detail/format.ts:85` | `* …（仅主管/审计），故���用同口径本地常量。` | 故**采用** / 故**复用** / 故**优先用** |
| `src/views/cert/detail/format.ts:237` | `* 级联筛选选项：云=全量去重；产���=当前云作用域内去重…` | 产**品**（与「云=」并列） |
| `src/views/cert/detail/format.test.ts:28` | `// ==== AC1：要素���展示逻辑 ====` | 要素**卡** / 要素**项** |
| `src/views/cert/settings/format.ts:242` | `/** 是否存在任一阈值���误（true → 保存按钮禁用）*/` | 阈值**错误** / 阈值**钳制错误** |

### 已修复的源码 22 行及其证据

| 位置 | 补 | 证据 |
| --- | --- | --- |
| `src/components/PageContainer/index.vue:96` | 区 | 同仓 `__tests__/PageContainer.test.ts:4`「覆盖标准骨架区块渲染」 |
| `src/components/__tests__/CommandPalette.test.ts:6` | 项可直 | `docs/features/ui-unify-phase2-components/tasks/6-commandpalette.md:29` |
| `src/components/__tests__/FilterBar.test.ts:367` | 的宽 | 同目录 `FilterBar/fit.ts:38`「行尾预留的宽度」 |
| `src/components/DataTable/index.vue:232` | 取 | 同仓 4 处「重新拉取」；注入 `）` 会破坏本行括号配平 |
| `src/utils/cert-nav.test.ts:26` | 台 | `prd-ui-functions.md:29`「证书台账」 |
| `src/views/cert/changes/format.ts:110` | 编辑 | 同仓 `ChangeTable.vue:83`、`changes/index.vue:71`「向导恢复编辑」 |
| `src/views/cert/changes/new/steps/Step1Select.vue:357` | ） | 结构：单行 `//` 注释内 `（` 未配对 |
| `src/views/cert/changes/new/steps/Step3List.vue:16` | 明 | 同仓 `ForwardReferences.vue:3`「盲区声明横幅常驻」 |
| `src/views/cert/changes/new/steps/Step5Progress.vue:190` | 试 | 同仓 `changes/index.vue:154` 整句逐字相同 |
| `src/views/cert/changes/new/steps/Step7Report.vue:44` | 徽 | 同仓 `AssetStatusBadge.vue:12`、`alert/events/__tests__/index.test.ts:5` |
| `src/views/cert/detail/components/ForwardReferences.vue:277` | 案 | 同仓 `cert/dashboard/format.ts:298`「筛选变化通告文案」 |
| `src/views/cert/detail/format.ts:125` | ） | 结构：L123–128 注释块「（」多一个 |
| `src/views/cert/detail/format.ts:285` | 行 | 同仓 `StatusBadge.vue:60`、`utils/constants.ts:292`「执行中」 |
| `src/views/cert/detail/format.ts:466` | 成 | `e-cam-service/docs/…` ×2「已成功落库」 |
| `src/views/cert/detail/index.vue:60` | 点 | `prd-ui-functions.md:29`「台账行点击」 |
| `src/views/cert/ledger/format.test.ts:224` | 名 | 同仓 `api/cert.ts:785`、`BatchImportModal.vue:320,365`「按去扩展名基名配对」 |
| `src/views/cert/settings/components/ExemptionListCard.vue:354` | 低 | 同仓 `CrdRegistrationCard.vue:511` 整句「响应式：小屏隐藏低优先列」 |
| `src/views/dashboard/index.vue:572` | 码 | 同仓 3 处「（零硬编码色）」 |

`haven-console` 侧同批修复 4 行（`api/types/permission.ts:76` 补 `（`、
`vite.config.ts:75` 补 `（`、`api/types/identity-source.ts:32` 补 `超`、
`stores/theme.ts:4` 补 `档`），证据见对应提交信息；该仓现已无源码乱码残留。

## §3 历史文档 11 行（按约定一律不改）

这些文件**记录的正是本次乱码的历次裁决**（含 `切���→切换` 的原始记录与 `U+FFFD` 复现脚本）。
改写它们等于篡改历史结论，故只在此处登记，正文一字不动。

> 补充事实：`.superpowers/` 与 `docs/` 均被 `e-cam-web/.gitignore:28` 忽略，**本身不在版本库内**
> （因此本清单放在仓根，才能随提交入库）。

- `e-cam-web/.superpowers/sdd/2026-08-11-platform-user-management/task-4-report.md:32`
- `e-cam-web/.superpowers/sdd/2026-08-11-tenant-unification-frontend/task-1-brief.md:10`
- `e-cam-web/.superpowers/sdd/2026-08-11-tenant-unification-frontend/task-5-brief.md:63`
- `e-cam-web/.superpowers/sdd/2026-09-20-ui-unify-phase1-tokens/progress.md:30,62`
- `e-cam-web/.superpowers/sdd/2026-09-20-ui-unify-phase1-tokens/task-2-3-report.md:84,124`
- `e-cam-web/.superpowers/sdd/2026-09-20-ui-unify-phase1-tokens/task-3-brief.md:14`
- `e-cam-web/.superpowers/sdd/2026-09-15-cdn-ops-insight/review-14f7081..aa520d5.diff:342`
  —— `<el-tag v-if="resp.truncated">结果已���断(可缩小时间范围或加筛选)</el-tag>` → `结果已截断`。
  这是**评审 diff 里引用的 Vue 片段**，说明同源乱码已扩散到本次范围之外的仓库（见 §5）。
- `e-cam-web/docs/superpowers/plans/2026-08-11-tenant-unification-frontend.md:70,486`

## §4 `e-cam-web/.claude/backups/**` 2 行

位于 agent 备份目录，已被 `.gitignore` 忽略、**不进入版本库**，无需处理。

## §5 范围之外：同一工作区其他目录的扫描结果

本次只治理 `e-cam-web` / `haven-console` / `opsagent-web` 三仓。对 `D:\Haven` 下全部目录
做同口径扫描（文本扩展名 + 排除二进制），结果如下——**均未做任何修改**，仅登记备查：

| 目录 | 文本乱码 | 说明 |
| --- | ---: | --- |
| `_mono-build` | 680 行 | 构建中间产物目录 |
| `e-cam-service` | 422 行 | Go 后端；`.kiro/specs/**` 与 `.claude/backups/**` 占绝大多数 |
| `e-cloudx-sdk` | 195 行 | |
| `docs`（工作区级） | 37 行 | platform-console 设计/评审文档，如 `而��白屏`→`而非白屏`、`校验规则���泛`→`宽泛` |
| `e-cmdb-web` | **0 行** | 已治理：`src/api/cmdb.ts` 的 21 行照抄**拆分前修订**整行恢复；余 `src/api/request/cert.ts:8` 1 行歧义保留标注 |
| `.claude`（工作区级） | 1900 行 / 1900 文件 | agent 备份，每文件 1 行，非版本库内容 |
| `.tmp-dsh-src` | 24 行 | **不是乱码**：DSH 自身源码中 `'\uFFFD'` 是解码失败时的占位字符，测试正是在断言它 |
| `eiam` / `opsagent` / `watch-alert` / `watch-alert-web` / `multi-cloud-dashboard` / `e-cmdb-service` / `tests` / `cmdb-design` 等 | 0 | ✓ |

**结论**：`haven-console`、`opsagent-web`、`e-cmdb-web` 三仓已清零；`e-cam-web` 版本库内仅剩 42 行（§1 + §2）。

### `e-cmdb-web` 的治理：一条最高等级的恢复路径

`e-cmdb-web` 由 `e-cam-web` 拆分而来（`e-cam-web` 提交 `5739d7e`），而 **`e-cam-web` 历史中的
`08de2a1:src/api/cmdb.ts` 正是拆分前的干净版本**（439 行、0 乱码）。逐行严格比对：

| 比对结果 | 行数 |
| --- | ---: |
| 与拆分前逐字节相同 | 418 |
| 可由拆分前版本整行恢复（去标记后仅差 1 个汉字 + 紧随的空格/右括号） | 21 |
| 无法解释的差异 | **0** |

于是这 21 行**直接照抄亲缘源，零推断**。乱码是在 `08de2a1 → 0346a23` 之间引入、
并随拆分一起被带走的。

**凡"从大仓拆出去的小仓/文件"出现乱码，都应先试这条路**：
`git log --all --oneline -- <path>` 找到原仓中的路径，再 `git show <rev>:<path>` 取干净版本。

⚠ 比对时必须先确认"其余行是否逐字节相同"，以区分**乱码行**与**拆分后本仓自己的改动**——
后者绝不能被亲缘源覆盖。

## 复核方法

对任一疑似乱码行，按以下顺序判定，**不满足就只标注**：

1. 取该行标记前后各 1–6 个**非空白字符**作锚点，在 14 万行源池中检索；
   若补全长度 1–3 字的所有命中**唯一**，且"补全词 ± 2 字上下文"能在池中找到完好出处，则为证据 A。
2. 否则统计该行**所在整个注释块**的全角括号，多出的一侧即为缺口（证据 B）。
3. 任何候选在补全后必须使整块括号配平（证据 C），否则否决。
4. **亲缘源优先（最高等级）**：若目标是"从大仓拆分出去的仓/文件"，先去原仓历史里找拆分前的修订
   （`git log --all --oneline -- <path>` → `git show <rev>:<path>`），整行照抄，
   优于任何字符级补全——`e-cmdb-web` 的 21 行全部由此恢复，0 推断。

> 关键教训一：**不要用 U+FFFD 的个数推算丢失字数**，也不要只看"锚点唯一"就采纳——
> 必须先确认补全后的词在**本仓**有完好出处，且不破坏括号配平。
>
> 关键教训二：`U+FFFD?` 的吞并长度**因文件而异**，同一工作区内不能套用同一假设：
> `cmdb.yaml` 的标记只吞掉 1 个汉字，而 `e-cmdb-web/src/api/cmdb.ts` 还会连吞紧随其后的
> 空格或右括号（`配置管理数据�? API` ← `配置管理数据库) API`，即 `库)` 两个字符）。
> 按"1 个字"补全这类文件会静默产生错字。
