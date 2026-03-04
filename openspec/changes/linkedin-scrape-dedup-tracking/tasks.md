## 1. 数据库层实现

- [x] 1.1 在db/schema.ts中添加companyScrapeHistory表定义,包含id、ownerId、companyUrl、maxItemsRequested、itemsReturned、itemsSaved、scrapedAt、filtersUsed字段
- [x] 1.2 在companyScrapeHistory表上创建(ownerId, companyUrl)索引以优化查询性能
- [x] 1.3 配置ownerId外键约束,设置onDelete: 'cascade'
- [x] 1.4 运行npm run db:generate生成数据库迁移文件
- [x] 1.5 运行npx drizzle-kit push应用数据库迁移
- [x] 1.6 使用npm run db:studio验证表结构创建成功

## 2. 后端API - 历史查询

- [x] 2.1 创建netlify/functions/check_company_history.ts文件
- [x] 2.2 实现用户认证逻辑(verifyToken)
- [x] 2.3 实现查询逻辑:根据ownerId和companyUrl查询历史记录,按scrapedAt倒序排列
- [x] 2.4 实现返回格式:hasHistory、lastScrape(最近一次记录)、totalScrapes(总次数)
- [x] 2.5 处理无历史记录的情况:返回hasHistory=false和空数据
- [x] 2.6 添加错误处理和适当的HTTP状态码

## 3. 后端API - 抓取增强

- [x] 3.1 在scrape_company.ts中,调用Apify后提取所有profileUrl
- [x] 3.2 实现批量查询数据库:使用inArray检查哪些profileUrl已存在于linkedinLeads表
- [x] 3.3 计算统计信息:totalReturned、alreadyExists、newProfiles、duplicateRate
- [x] 3.4 在返回items前,将本次抓取记录保存到companyScrapeHistory表
- [x] 3.5 修改返回格式:增加stats对象包含统计信息
- [x] 3.6 确保quota计费逻辑保持不变(按items.length计算)

## 4. 前端服务层

- [x] 4.1 在services/apify.ts中添加checkCompanyHistory函数
- [x] 4.2 实现API调用逻辑:GET /api/check_company_history?companyUrl=xxx
- [x] 4.3 添加认证header(authClient.getAuthHeaders)
- [x] 4.4 定义TypeScript类型:CompanyHistoryResponse接口

## 5. 前端UI - 警告Modal

- [x] 5.1 在Home.tsx中创建警告Modal组件状态(showWarningModal, historyData)
- [x] 5.2 修改handleScrape函数:在Company模式下先调用checkCompanyHistory
- [x] 5.3 如果hasHistory=true,显示警告Modal而不是直接调用scrape_company
- [x] 5.4 实现Modal UI:显示上次抓取时间、获取数量、保存数量
- [x] 5.5 添加警告说明:LinkedIn列表动态变化、可能重复、Apify按实际返回数量收费
- [x] 5.6 添加建议文案:建议直接获取需要的最大数量
- [x] 5.7 实现"继续"按钮:关闭Modal并调用scrape_company
- [x] 5.8 实现"取消"按钮:关闭Modal并停止抓取流程
- [x] 5.9 实现点击Modal外部或ESC键关闭Modal

## 6. 前端UI - 统计信息显示

- [x] 6.1 修改scrapeCompany函数的返回类型,增加stats字段
- [x] 6.2 在抓取完成后检查响应中是否包含stats对象
- [x] 6.3 在预览区域顶部或底部添加统计信息显示组件
- [x] 6.4 格式化显示统计信息:例如"获取了100个profiles,其中45个已存在(45%),55个是新的"
- [x] 6.5 使用友好的样式展示统计信息(可以使用info/success样式)

## 7. 测试和验证

- [ ] 7.1 测试第一次抓取公司:应该无警告,显示统计信息(0%重复)
- [ ] 7.2 测试第二次抓取同一公司:应该显示警告Modal,包含上次抓取信息
- [ ] 7.3 测试用户点击"取消":应该停止抓取,不调用Apify
- [ ] 7.4 测试用户点击"继续":应该调用Apify并显示统计信息
- [ ] 7.5 验证统计信息准确性:检查totalReturned、newProfiles、alreadyExists数量是否正确
- [ ] 7.6 验证历史记录保存:检查companyScrapeHistory表中的数据是否正确
- [ ] 7.7 测试不同过滤条件:使用jobTitles或locations过滤,验证filtersUsed字段保存正确
- [ ] 7.8 测试quota计费:验证仍然按items.length计算,不受去重影响
