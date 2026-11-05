/**
 * 详情抽屉「占位标签页」的文案（iter212）。
 *
 * 背景：10 个 DetailDrawer 的占位分支原本都写
 *   `<p>{{ activeTab }} 功能开发中...</p>`
 * 把**内部变量名**（monitor / alarm / log / whitelist / backup / acl ...）直接渲染到了界面上，
 * 中文界面里出现 "monitor 功能开发中..." 这种半英文、且毫无信息量的文案。
 *
 * 这里统一成「中文标题 + 去哪儿看」两句：让占位态也能告诉用户**数据在哪**。
 * 未登记的行 key 会走兜底分支，保证**任何情况下都不会再把内部 key 漏给用户**。
 */

export interface TabPlaceholder {
  /** 标题：说明「这一页为什么是空的」 */
  title: string
  /** 描述：告诉用户「去哪儿能看到这类数据」 */
  desc: string
}

/** 按 tab 的内部 key 登记中文文案。新增 tab 时请在这里补一条。 */
export const TAB_PLACEHOLDERS: Record<string, TabPlaceholder> = {
  // ── 通用 ──
  log: {
    title: '操作日志暂未接入',
    desc: '本页暂未接入该资源的操作日志。可在「操作审计」中按资源与时间检索。',
  },
  monitor: {
    title: '监控图表暂未接入',
    desc: '本页暂未接入该资源的监控时序数据。可前往云厂商控制台查看 CPU / 内存 / 网络曲线。',
  },
  alarm: {
    title: '告警信息暂未接入',
    desc: '本页暂未接入该资源的告警记录。可在「告警规则」中查看规则配置与触发情况。',
  },
  task: {
    title: '任务记录暂未接入',
    desc: '本页暂未接入该资源的异步任务列表。可在「任务列表」中按资源筛选查看。',
  },
  schedule: {
    title: '定时任务暂未接入',
    desc: '本页暂未接入该资源的定时任务。可在「任务列表」中查看调度计划。',
  },

  // ── 快照 / 磁盘 ──
  snapshot: {
    title: '快照列表暂未接入',
    desc: '本页暂未接入该磁盘的快照列表。可在「快照列表」中按磁盘筛选查看。',
  },

  // ── 安全组 ──
  instances: {
    title: '关联实例暂未接入',
    desc: '本页暂未接入绑定了该安全组的实例列表。可在「主机列表」中按安全组筛选查看。',
  },

  // ── 数据库类（MongoDB / RDS / Redis）──
  whitelist: {
    title: '白名单暂未接入',
    desc: '本页暂未接入该实例的访问白名单。可前往云厂商控制台查看与修改 IP 白名单。',
  },
  backup: {
    title: '备份暂未接入',
    desc: '本页暂未接入该实例的备份记录。可前往云厂商控制台查看备份策略与备份集。',
  },

  // ── 中间件类（ES / Kafka）──
  index: {
    title: '索引列表暂未接入',
    desc: '本页暂未接入该集群的索引信息。可前往云厂商控制台或 Kibana 查看索引与分片状态。',
  },
  topic: {
    title: 'Topic 列表暂未接入',
    desc: '本页暂未接入该实例的 Topic 信息。可前往云厂商控制台查看 Topic 与分区详情。',
  },

  // ── 存储类（NAS / OSS）──
  mount: {
    title: '挂载点暂未接入',
    desc: '本页暂未接入该文件系统的挂载点信息。可前往云厂商控制台查看挂载地址。',
  },
  tags: {
    title: '标签暂未接入',
    desc: '本页暂未接入该资源的标签。可在「标签管理」中按资源查看与批量绑定。',
  },
  files: {
    title: '文件列表暂未接入',
    desc: '本页暂未接入该存储桶的对象列表。可前往云厂商控制台或使用客户端查看。',
  },
  acl: {
    title: '访问控制暂未接入',
    desc: '本页暂未接入该存储桶的 ACL / 权限策略。可前往云厂商控制台查看与修改。',
  },
  lifecycle: {
    title: '生命周期规则暂未接入',
    desc: '本页暂未接入该存储桶的生命周期配置。可前往云厂商控制台查看转换与过期规则。',
  },
}

/**
 * 取占位文案。**永远返回中文**，不会把 tabKey 原样返回 ——
 * 这是「不再把内部 key 漏给用户」的兜底保证。
 */
export function placeholderFor(tabKey: string): TabPlaceholder {
  return (
    TAB_PLACEHOLDERS[tabKey] ?? {
      title: '该标签页暂无内容',
      desc: '当前版本尚未提供此标签页的数据，后续会逐步接入。',
    }
  )
}
