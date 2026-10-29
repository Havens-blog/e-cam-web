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
