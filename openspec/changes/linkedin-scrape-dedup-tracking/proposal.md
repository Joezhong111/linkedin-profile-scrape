## Why

用户通过Apify抓取LinkedIn公司员工数据时,如果对同一公司多次调用(例如第一次获取50个,第二次获取100个),会导致重复获取前50个profiles,造成Apify费用浪费。需要在调用Apify前警告用户可能的重复情况,并在抓取后提供去重统计信息,帮助用户优化抓取策略。

## What Changes

- 新增数据库表`company_scrape_history`记录每次公司抓取的历史(公司URL、获取数量、保存数量、时间等)
- 新增API `/api/check_company_history`用于查询指定公司的抓取历史
- 修改`scrape_company.ts`在调用Apify后检查数据库中已存在的profileUrl,计算去重统计(总数、新增、重复、重复率),并记录到历史表
- 修改前端`Home.tsx`在用户输入company URL后调用历史检查API,如果有历史记录则显示警告Modal提示可能的重复和建议
- 前端显示抓取完成后的去重统计信息(获取数量、新增数量、重复数量、重复率)

## Capabilities

### New Capabilities
- `company-scrape-history`: 记录和查询公司抓取历史,包括数据库表结构、历史记录API、去重检查逻辑
- `scrape-dedup-warning`: 前端抓取前的重复警告系统,包括历史检查、警告Modal、用户确认流程

### Modified Capabilities
<!-- 没有修改现有capabilities的需求,只是在现有scrape_company基础上增强 -->

## Impact

**后端影响:**
- 数据库: 新增`company_scrape_history`表
- API: 新增`/api/check_company_history`端点
- 修改: `netlify/functions/scrape_company.ts`增加去重检查和历史记录逻辑

**前端影响:**
- 修改: `pages/Home.tsx`增加历史检查和警告Modal
- 修改: `services/apify.ts`增加`checkCompanyHistory`函数
- UI: 新增警告Modal组件和统计信息显示

**数据库Schema:**
- `db/schema.ts`新增表定义
- 需要运行数据库迁移

**用户体验:**
- 用户在抓取前会看到历史警告(如果有)
- 用户在抓取后会看到详细的去重统计
- 帮助用户避免不必要的Apify费用浪费
