# CAM 接口审计脚本

把迭代中被反复手工执行的**接口级检查**固化为可重复运行的审计。仅用 Node 内置 `fetch`，**不引入新依赖**。

## 运行

```bash
# 1) 从浏览器取会话 cookie：DevTools → Application → Cookies → 复制 ecmdb-token-key 的值
# 2) 运行（默认打 http://localhost:8888，即 nginx 入口）
ECAM_BASE=http://localhost:8888 \
ECAM_COOKIE='ecmdb-token-key=xxxxx' \
node scripts/audit/cam-api-audit.mjs

# 只跑某一类
... node scripts/audit/cam-api-audit.mjs --only=secrets    # 敏感字段泄漏
... node scripts/audit/cam-api-audit.mjs --only=filters    # 筛选是否生效
... node scripts/audit/cam-api-audit.mjs --only=paging     # 分页是否生效
... node scripts/audit/cam-api-audit.mjs --only=details    # 详情接口可用性
... node scripts/audit/cam-api-audit.mjs --only=invalid    # 非法输入不得 5xx
... node scripts/audit/cam-api-audit.mjs --only=limits     # 分页上限保护(警告类)
```

退出码：`0` 全通过 ｜ `1` 有疑似问题（**需人工确认**）｜ `2` 环境/鉴权不可用。
"分页上限保护"属**警告类**（已知未决项，不计失败），详见下节。

## 检查项与判据

| 检查 | 判据 |
|---|---|
| 敏感字段泄漏 | 响应中不得出现明文 AK/SK、私钥、JWT、未打码的 `secret/password/client_secret` |
| 筛选是否生效 | 带"必然无结果"的筛选值后，`total`/条目数应变化；**>0 且不变 ⇒ 疑似被忽略** |
| 分页是否生效 | 第 1 页与第 2 页条目集合应不同；**完全相同 ⇒ 疑似被忽略** |
| 详情接口可用性 | 列表首条的标识能打开详情且非空；**详情 handler 常滞后于列表** |
| 非法输入健壮性 | 非法/越界查询值应 4xx 正确拒绝或 200 容错；**5xx 记为失败** |
| 分页上限保护 | 超大 `limit` 不应一次性返回全量；**>1000 条/页 记为警告**（未决） |

## 已知未决项（警告，不阻塞）

**分页上限保护缺失**：`limit=999999` 会一次性返回全量 —— 实测 资产 DISK **5228 条 / 6.4MB**、
审计日志 **7360 条 / 4.5MB**、资产 ECS **2813 条 / 4.8MB**。
风险：绕过分页、放大内存与带宽（可被轻量请求放大成 DoS 面）。
修复建议：在读取 `limit` 处加合理上限（前端当前最大只请求 **200**，故上限取 500~1000 对现有客户端零影响）；
但 `limit` 读取点分布于 **25 个文件**，属跨模块改动，**需维护者确认后统一实施**（决策后把该项从"警告"改为"失败"判据）。

## 维护约定（血泪教训，务必遵守）

1. **探针必须使用前端真实发送的参数名与形态**。先到源码确认：`src/api/<module>.ts` 的参数类型 + 页面构造请求处（例如审计页是 `offset:(page-1)*pageSize` 而非 `page/size`）。
   用"看起来合理"的参数名探测会产生**假阳性**——实测踩过两次（用 `page/size` 探审计日志、用 `cloud_platform` 探一个页面根本没有的筛选项）。
2. **响应键名因接口而异**：资产用 `items`、任务用 `tasks`、部分接口直接返回数组。脚本的 `listOf()` 已做兼容；新增用例若碰到新形态，先补 `listOf()` 再判断。
3. **"首页为空"不等于分页失效**：可能是该接口的参数形态不同或本就无数据，脚本按"无法判定"处理（不计失败），避免把探测误差报成缺陷。
4. 判定为 ⚠ 时，**下一步必须是人工核实**（读前端源码 + 在浏览器里复现），再决定是否修为缺陷。
5. **参数只在"真正使用它的模块"上有效**，别拿泛型参数到处试：`business_type`/`service_area` 只出现在
   CDN 模块（列/详情展示 + 筛选），在 ECS/DISK 等接口上返回不变属**正常**；实测 CDN 上是有效的
   （`business_type=download` → 5、无值 → 681、bogus → 0）。
   同理 **OSS 无 `status` 属性**（页面注释与 `ListOSSParams` 均无该参数），拿 `status=bogus` 探 OSS 返回全量属**设计如此**。
6. **探测"重复请求/空白页"要防三类假阳性**：① **轮询**（任务页主列表每 ~5s 自动刷新，两次请求间隔 5.2s 属设计，
   不是重复触发）；② **组件形态**（磁盘/任务页是自定义表格或卡片列表，数 `.el-table__row` 会得 0，
   应先用 `tbody tr`／卡片选择器对照 DOM）；③ **自造路径**（`/cam/cert/ledger` 实为 `/cam/certs/ledger`，会命中
   404 兜底页而看起来"空白"）。**路径一律取自 `src/router/routes.ts`。**
7. **失败提示不等于缺陷**：仪表盘"资产类别统计"依赖后端调外部 CMDB 服务，本地未起该依赖时会报错，
   但前端已有 `StateBlock`（`error-text` + 重试）与 `ElMessage.error` ⇒ 属**环境依赖不可用**而非 UI 缺陷。

