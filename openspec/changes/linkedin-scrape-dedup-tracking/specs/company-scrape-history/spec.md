## ADDED Requirements

### Requirement: 记录公司抓取历史
系统SHALL在每次调用Apify抓取公司员工数据后,将抓取记录保存到数据库,包括公司URL、请求数量、实际返回数量、保存到数据库的数量、抓取时间和使用的过滤条件。

#### Scenario: 成功记录抓取历史
- **WHEN** 用户通过scrape_company API成功抓取公司数据
- **THEN** 系统SHALL在company_scrape_history表中创建一条新记录,包含ownerId、companyUrl、maxItemsRequested、itemsReturned、itemsSaved、scrapedAt和filtersUsed字段

#### Scenario: 记录包含过滤条件
- **WHEN** 用户使用jobTitles或locations等过滤条件抓取数据
- **THEN** 系统SHALL将这些过滤条件以JSON格式保存到filtersUsed字段

### Requirement: 查询公司抓取历史
系统SHALL提供API端点允许用户查询指定公司的抓取历史记录。

#### Scenario: 查询存在的历史记录
- **WHEN** 用户调用check_company_history API并提供有效的companyUrl
- **THEN** 系统SHALL返回该用户对该公司的所有历史抓取记录,按时间倒序排列

#### Scenario: 查询不存在的历史记录
- **WHEN** 用户查询从未抓取过的公司
- **THEN** 系统SHALL返回空数组和hasHistory=false标志

#### Scenario: 只返回当前用户的历史
- **WHEN** 用户查询公司历史
- **THEN** 系统SHALL只返回该用户自己的抓取记录,不包含其他用户的记录

### Requirement: 计算去重统计信息
系统SHALL在调用Apify后检查返回的profiles中有多少已存在于数据库,并计算统计信息。

#### Scenario: 计算新增和重复数量
- **WHEN** scrape_company从Apify获取到profiles列表
- **THEN** 系统SHALL查询数据库检查哪些profileUrl已存在,并计算totalReturned、alreadyExists、newProfiles和duplicateRate

#### Scenario: 返回统计信息给前端
- **WHEN** scrape_company完成数据处理
- **THEN** 系统SHALL在响应中包含items数组和stats对象,stats包含totalReturned、alreadyExists、newProfiles和duplicateRate字段

### Requirement: 数据库表结构
系统SHALL创建company_scrape_history表用于存储抓取历史。

#### Scenario: 表结构定义
- **WHEN** 数据库迁移执行
- **THEN** 系统SHALL创建包含以下字段的表: id(uuid PK)、ownerId(uuid FK)、companyUrl(text)、maxItemsRequested(integer)、itemsReturned(integer)、itemsSaved(integer)、scrapedAt(timestamp)、filtersUsed(jsonb)

#### Scenario: 索引优化
- **WHEN** 表创建完成
- **THEN** 系统SHALL在(ownerId, companyUrl)上创建索引以优化查询性能

#### Scenario: 外键约束
- **WHEN** 用户被删除
- **THEN** 系统SHALL通过CASCADE删除该用户的所有抓取历史记录
