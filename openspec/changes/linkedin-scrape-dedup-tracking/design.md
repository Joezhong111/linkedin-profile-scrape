## Context

当前系统允许用户通过Apify Actor抓取LinkedIn公司员工数据。用户可以指定maxItems参数控制获取数量。问题在于:

1. **Apify Actor不支持offset/cursor参数** - 每次调用都从头开始返回profiles,无法实现真正的增量获取
2. **LinkedIn员工列表是动态的** - 会因新员工加入、离职、排序变化等原因变化
3. **重复调用造成费用浪费** - 用户可能先获取50个试试,觉得不错再获取100个,导致前50个重复,但Apify按实际返回数量收费

当前系统已有数据库层去重机制(linkedinLeads表的unique index: ownerId + profileUrl),但这只能防止数据库重复,无法避免Apify费用浪费。

**约束条件:**
- 使用Neon PostgreSQL + Drizzle ORM
- 后端使用Netlify Functions
- 前端使用React + TypeScript
- 现有quota系统按items.length计费

## Goals / Non-Goals

**Goals:**
- 在用户调用Apify前警告可能的重复情况,帮助用户做出明智决策
- 提供透明的去重统计信息,让用户了解实际获取了多少新数据
- 记录抓取历史,支持查询和分析
- 保持现有quota计费逻辑(按Apify实际返回数量),反映真实成本

**Non-Goals:**
- 不实现真正的增量获取(Apify Actor不支持)
- 不改变quota计费逻辑为"只计新增数量"(会隐藏真实成本)
- 不阻止用户重复抓取(只警告,最终决策权在用户)
- 不处理LinkedIn API的排序变化问题(这是外部因素,无法控制)

## Decisions

### 决策1: 数据库表设计 - 记录每次抓取而非只记录最新

**选择:** 每次抓取都创建新记录,保留完整历史

**理由:**
- 用户可能使用不同的过滤条件(jobTitles, locations)多次抓取同一公司
- 完整历史有助于分析和审计
- 可以看到重复率的趋势(第一次0%,第二次可能45%,第三次可能60%)

**替代方案:**
- 只保留最新一次记录 → 丢失历史信息,无法分析趋势
- 使用upsert更新最新记录 → 无法区分不同过滤条件的抓取

**表结构:**
```sql
company_scrape_history (
  id uuid PK,
  owner_id uuid FK,
  company_url text,
  max_items_requested integer,
  items_returned integer,
  items_saved integer,
  scraped_at timestamp,
  filters_used jsonb,
  INDEX (owner_id, company_url)
)
```

### 决策2: 去重检查时机 - 在scrape_company后端进行

**选择:** 在scrape_company.ts中,调用Apify后立即检查数据库

**理由:**
- 集中逻辑,避免前端重复实现
- 可以在一次数据库查询中批量检查所有profileUrl
- 返回统计信息给前端,前端只负责展示

**替代方案:**
- 前端逐个检查 → 需要N次API调用,性能差
- 保存时才检查 → 无法提前告知用户统计信息

**实现:**
```typescript
// 提取所有profileUrl
const profileUrls = items.map(item => extractProfileUrl(item));

// 批量查询已存在的
const existing = await db.select()
  .from(linkedinLeads)
  .where(and(
    eq(linkedinLeads.ownerId, userId),
    inArray(linkedinLeads.profileUrl, profileUrls)
  ));

const existingSet = new Set(existing.map(e => e.profileUrl));
const newCount = profileUrls.filter(url => !existingSet.has(url)).length;
```

### 决策3: 警告时机 - 在用户点击Scrape按钮时检查

**选择:** 用户点击Scrape按钮 → 调用check_company_history → 显示警告Modal(如果有历史) → 用户确认 → 调用scrape_company

**理由:**
- 在用户输入URL时就检查会导致频繁的API调用(每次输入变化都触发)
- 在点击按钮时检查,只在用户明确要抓取时才调用API
- 给用户最后一次机会重新考虑

**替代方案:**
- 输入URL时实时检查 → API调用过于频繁
- 不检查,直接在结果中显示统计 → 无法阻止不必要的Apify调用

### 决策4: Quota计费保持不变 - 按Apify返回数量

**选择:** quota消耗 = items.length (Apify实际返回数量)

**理由:**
- 反映真实的Apify成本
- 激励用户避免重复调用
- 透明,不隐藏实际费用

**替代方案:**
- 按新增数量计费 → 对用户友好,但隐藏了真实成本,可能导致用户不重视重复问题

### 决策5: 历史查询API返回最近一次记录

**选择:** check_company_history返回最近一次抓取记录和总次数

**理由:**
- 警告Modal只需要显示最近一次的信息
- 减少数据传输量
- 如果需要完整历史,可以后续扩展

**返回格式:**
```typescript
{
  hasHistory: boolean,
  lastScrape: {
    scrapedAt: string,
    maxItemsRequested: number,
    itemsReturned: number,
    itemsSaved: number,
    filtersUsed: object
  } | null,
  totalScrapes: number
}
```

## Risks / Trade-offs

### 风险1: LinkedIn排序变化导致"新"数据实际是旧数据
**影响:** 用户可能认为获取了新员工,但实际只是排序变了
**缓解:** 在警告Modal中明确说明LinkedIn列表会动态变化,设置正确的期望

### 风险2: 用户忽略警告,继续重复抓取
**影响:** 仍然浪费Apify费用
**缓解:**
- 警告文案清晰说明费用影响
- 显示上次抓取的统计信息,让用户看到具体数字
- 提供"建议"而非"阻止",尊重用户决策

### 风险3: 数据库查询性能 - 批量检查profileUrl
**影响:** 如果items很多(如1000个),inArray查询可能较慢
**缓解:**
- 在(ownerId, profileUrl)上创建索引
- 如果性能仍有问题,可以考虑分批查询(每次100个)
**监控:** 在生产环境监控scrape_company的响应时间

### 风险4: 历史表数据增长
**影响:** 如果用户频繁抓取,历史表会快速增长
**缓解:**
- 当前不实现清理逻辑,观察实际使用情况
- 未来可以考虑:保留最近N次记录,或保留最近N天的记录
**权衡:** 完整历史 vs 存储成本,当前选择完整历史

### Trade-off: 不实现"智能建议maxItems"
**考虑过:** 根据历史记录,建议用户"你已有50个,建议获取100个"
**决定不做:**
- LinkedIn列表动态变化,无法准确预测
- 可能误导用户
- 增加复杂度,收益不明确
**当前方案:** 只提供信息和警告,让用户自己决定

## Migration Plan

**数据库迁移:**
1. 在db/schema.ts中添加companyScrapeHistory表定义
2. 运行`npm run db:generate`生成迁移文件
3. 运行`npx drizzle-kit push`或`npm run db:migrate`应用迁移
4. 验证表创建成功:`npm run db:studio`查看表结构

**部署步骤:**
1. 部署后端代码(新增check_company_history.ts,修改scrape_company.ts)
2. 部署前端代码(修改Home.tsx和services/apify.ts)
3. 运行数据库迁移
4. 测试完整流程:
   - 第一次抓取公司 → 无警告,显示统计
   - 第二次抓取同一公司 → 显示警告,显示统计

**回滚策略:**
- 如果前端有问题:回滚前端代码,后端仍可正常工作(只是不显示警告)
- 如果后端有问题:回滚后端代码,前端会收到API错误,但不影响现有功能
- 数据库表:不需要回滚,新表不影响现有功能

**向后兼容:**
- scrape_company的响应格式变化(增加stats字段),但前端可以兼容处理
- 如果stats不存在,前端不显示统计信息,不影响核心功能

## Open Questions

无待解决问题。设计已明确。
