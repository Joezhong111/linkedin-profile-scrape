## ADDED Requirements

### Requirement: 抓取前检查历史记录
系统SHALL在用户输入company URL后,自动查询该公司的抓取历史,如果存在历史记录则显示警告信息。

#### Scenario: 检测到历史记录时显示警告
- **WHEN** 用户在Company Search模式下输入company URL并点击Scrape按钮
- **THEN** 系统SHALL调用check_company_history API,如果返回hasHistory=true,则显示警告Modal

#### Scenario: 无历史记录时直接抓取
- **WHEN** 用户输入从未抓取过的公司URL
- **THEN** 系统SHALL直接调用scrape_company API,不显示警告

#### Scenario: 警告Modal包含历史信息
- **WHEN** 警告Modal显示
- **THEN** Modal内容SHALL包含上次抓取时间、获取数量、保存数量,以及关于LinkedIn列表动态变化和可能重复的说明

### Requirement: 用户确认流程
系统SHALL允许用户在看到警告后选择继续或取消抓取操作。

#### Scenario: 用户选择继续
- **WHEN** 用户在警告Modal中点击"继续"按钮
- **THEN** 系统SHALL关闭Modal并执行scrape_company API调用

#### Scenario: 用户选择取消
- **WHEN** 用户在警告Modal中点击"取消"按钮
- **THEN** 系统SHALL关闭Modal并停止抓取流程,不调用Apify

#### Scenario: 用户可以关闭Modal
- **WHEN** 用户点击Modal外部区域或关闭按钮
- **THEN** 系统SHALL关闭Modal并停止抓取流程

### Requirement: 显示去重统计结果
系统SHALL在抓取完成后显示详细的去重统计信息。

#### Scenario: 显示统计信息
- **WHEN** scrape_company API返回包含stats对象的响应
- **THEN** 系统SHALL在UI中显示totalReturned、newProfiles、alreadyExists和duplicateRate信息

#### Scenario: 统计信息格式化显示
- **WHEN** 显示统计信息
- **THEN** 系统SHALL使用友好的格式,例如"获取了100个profiles,其中45个已存在(45%),55个是新的"

#### Scenario: 统计信息在预览区域显示
- **WHEN** 抓取完成并显示预览数据
- **THEN** 系统SHALL在预览区域顶部或底部显示统计信息,让用户清楚了解去重情况

### Requirement: 警告内容准确性
系统SHALL在警告中提供准确的建议和说明,帮助用户理解LinkedIn数据的动态特性。

#### Scenario: 说明LinkedIn列表会变化
- **WHEN** 警告Modal显示
- **THEN** 内容SHALL包含说明:LinkedIn员工列表会因新员工加入、离职、排序变化等原因动态变化

#### Scenario: 说明去重机制
- **WHEN** 警告Modal显示
- **THEN** 内容SHALL说明系统会自动去重,只保存新的profiles到数据库

#### Scenario: 说明Apify费用
- **WHEN** 警告Modal显示
- **THEN** 内容SHALL说明Apify会按实际返回数量收费,即使数据重复

#### Scenario: 提供建议
- **WHEN** 警告Modal显示
- **THEN** 内容SHALL建议用户直接获取需要的最大数量,避免多次调用造成重复
