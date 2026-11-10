# Cloudflare 迁移提示词（阶段 0–5）

> 用法：每个阶段的提示词单独复制给编码 agent。一次只做一个阶段，验收通过再进入下一阶段。所有阶段都在新分支 `feat/cloudflare-workers-d1` 上进行，生产 Netlify 保持不动，直到阶段 5。
>
> 每个提示词都假设 agent 会先读 `AGENTS.md` 和本文件顶部。提示词里已经写了关键路径和约束；如果 agent 需要更多细节，让它自己读对应文件，不要猜。

## 共用上下文

- 项目：LinkedIn Insights Pro。React 19 + Vite + TypeScript；当前部署是 Netlify Functions + Neon PostgreSQL + Drizzle `pg-core`。
- 后端有 22 个 Netlify Functions：`netlify/functions/*.ts`，统一是 `handler(event)` 签名，`netlify.toml` 把 `/api/*` 重定向到对应函数。
- 数据层：`db/schema.ts`（13 张表）、`db/client.ts`（模块级 `pg.Pool`）、`drizzle.config.ts`（PostgreSQL）。
- 认证：不是 JWT 签发；`lib/auth-server.ts` 用 `crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512')` 存 `salt:hash`，登录后发随机 token 存 `sessions` 表。`JWT_SECRET` 实际没被代码使用。
- 前端两种抓取模式，路径都在 `services/apify.ts`：
  - Profile URLs：一个或多个 `linkedin.com/in/...`，调用 `/api/scrape` → dev_fusion actor `2SyF0bVxmgGr8IVCZ`，保存到 `linkedin_profiles`，页面 `#/profiles`。
  - Company Search：一个 `linkedin.com/company/...` + `maxItems` + 职位/地点/年限过滤，调用 `/api/scrape_company` 启动 HarvestAPI actor `Vb6LZkh4EqRlR0Ka9`，再轮询 `/api/check_scrape_status`，保存到 `linkedin_leads`，页面 `#/leads`。
- 前端所有 API 都是相对路径 `/api/*`，同域；hash 路由；迁移 Worker 后前端代码原则上不改。
- 目标：Cloudflare Workers 静态资源 + `/api/*`，D1 binding `DB`，Drizzle SQLite；抓取供应商通过 provider 抽象，Apify 和 treg 可切换。
- 迁移期间约束：
  - 不改前端业务行为，不改 `/api/*` 路径和响应字段名。
  - 不删除 Netlify / Neon / Apify 旧代码，直到阶段 5。
  - 不把旧 PostgreSQL migration 混进新的 D1 migration 目录。
  - 所有 D1 查询保持 owner 隔离和月度配额逻辑。
  - 编译产物里不能出现 Node-only 的 `pg` / `apify-client` / `proxy-agent`。
  - 每个阶段结束跑：`pnpm lint`、`pnpm build`、`pnpm test`；能部署就加 `pnpm exec wrangler deploy --dry-run`。

---

## 阶段 0：D1 schema 预研

### 提示词（可直接复制）

你是本项目（LinkedIn Insights Pro）的迁移工程师。现在做阶段 0：**只把数据库 schema 和本地 D1 打通，不改任何业务 handler，不部署**。

先读：
- `AGENTS.md`
- `db/schema.ts`
- `db/client.ts`
- `drizzle.config.ts`
- `scripts/create-admin.js`
- `package.json`

背景：当前是 Neon PostgreSQL + Drizzle `pg-core`，13 张表。目标是在新分支 `feat/cloudflare-workers-d1` 上把 schema 改成 SQLite/D1，先本地跑通。

任务：

1. 创建并切换到分支 `feat/cloudflare-workers-d1`（如果已存在就直接用）。
2. 新增最小 `wrangler.jsonc`，只包含：
   - `name`
   - `compatibility_date`（用当前日期）
   - `d1_databases`：`binding = "DB"`、`database_name = "linkedin-insights-pro"`、`database_id`（没有真实 ID 时先用占位 UUID，阶段 1 前替换）、`migrations_dir = "drizzle-d1"`
   本阶段不要加 `main` 和 `assets`。
3. 把 `db/schema.ts` 从 `drizzle-orm/pg-core` 迁到 `drizzle-orm/sqlite-core`，保持表名、列名、索引名、外键和 `$inferSelect` 类型不变。映射规则：
   - `uuid` → `text`，主键用 `$defaultFn(() => crypto.randomUUID())`；保留现有 primary key（包括表级 `primaryKey`）。
   - `timestamp(..., { mode: 'string' })` → `text`，默认值用 `$defaultFn(() => new Date().toISOString())`，保持 ISO 字符串格式；不要用 `CURRENT_TIMESTAMP` 的 `YYYY-MM-DD HH:MM:SS` 格式，避免和现有 ISO 比较混用。
   - `jsonb` → `text(..., { mode: 'json' }).$type<any>()`。
   - `bigint(..., { mode: 'number' })` → `integer(..., { mode: 'number' })`。
   - `numeric(..., { mode: 'number' })` → `real`。
   - `boolean` → `integer(..., { mode: 'boolean' })`。
   - `text('role', { enum: [...] })` 保留 enum。
   - `references(..., { onDelete: 'cascade' })` 保留；D1 默认强制外键。
   - 删除 `gen_random_uuid()` 和 `timezone('utc'::text, now())` 这类 PG 专属默认值。
   - `scrape_jobs.apify_run_id` 当前没有代码引用；可以顺手改成 `provider_job_id` 并新增 `provider` 字段，也可以保留原名等阶段 4 再改。二选一，不要半改。
4. 新增 `worker/db.ts`（或 `lib/db.ts`，选一个并统一）：
   - `createDb(d1: D1Database)` 返回 `drizzle(d1, { schema })`。
   - 导出 `AppDb` 类型。
   - 导出 `chunk<T>(items: T[], size = 90): T[][]`，用于 D1 单查询最多 100 个绑定参数的限制。
5. 改 `drizzle.config.ts`：
   - `dialect: 'sqlite'`
   - `schema: './db/schema.ts'`
   - `out: './drizzle-d1'`
   - 本阶段不要求远程迁移；先保证 `drizzle-kit generate` 能生成 `drizzle-d1/`。
   - 不要删除现有 `drizzle/`（PG 迁移），阶段 5 再清理。
6. 生成迁移并在本地 D1 应用：
   - `pnpm exec drizzle-kit generate`
   - `pnpm exec wrangler d1 migrations apply DB --local`
   - 如果 `wrangler d1 migrations apply` 不接受 Drizzle 生成的多语句文件，改用 `drizzle-kit migrate` + `driver: 'd1-http'`，二选一，不要同时维护两套 migration 记录。
7. 重写/新增 admin seed：
   - 现有 `scripts/create-admin.js` 用 `pg` + `crypto.pbkdf2Sync`，保留同样的 `salt:hash` 格式。
   - 新增 `scripts/create-admin-d1.mjs`（或改造原脚本），用 `wrangler d1 execute DB --local --file` 或 `--command` 写入 `users` 和 `user_roles`。
   - 参数仍是 `<email> <password>`；支持本地和 `--remote`；SQL 字符串要正确转义单引号。
8. 写一个本地 smoke：
   - 插入 admin、`user_roles`、一个 `linkedin_profiles`、一个 `linkedin_leads`、一条 `monthly_usage`。
   - 查询这些表；验证外键 cascade（删除测试用户后子表行消失）。
   - 验证 `chunk()`：构造 101 个 id，按 90 切片。
9. 跑 `pnpm exec tsc --noEmit`（或项目现有的类型检查方式）和 `pnpm build`。

验收：
- `drizzle-d1/` 生成成功，`wrangler d1 migrations apply DB --local` 成功。
- 本地 D1 中 13 张表都存在，表名/列名和原 schema 一致。
- `db/schema.ts` 不再 import `drizzle-orm/pg-core`。
- admin seed 能在本地 D1 创建管理员，密码 hash 格式仍是 `salt:hash`。
- smoke 能插入/查询/验证 cascade。
- 没有改任何 `netlify/functions/*`、Worker handler、前端页面，也没有部署。

不要：
- 不要 port 22 个 handler。
- 不要加 `main`/`assets`/Worker fetch。
- 不要删除 Netlify、Neon、`pg` 依赖或旧 `drizzle/`。
- 不要用 `gen_random_uuid()`、`timezone('utc'::text, now())` 或其他 PG 语法。
- 不要为了让 SQLite 通过而放宽唯一索引/外键。

---

## 阶段 1：Worker 骨架 + 静态资源 + health

### 提示词（可直接复制）

你是本项目（LinkedIn Insights Pro）的迁移工程师。阶段 0 已经把 `db/schema.ts` 迁到 SQLite、生成 `drizzle-d1/`、本地 D1 可用。现在做阶段 1：**让 Cloudflare Worker 能托管前端静态资源并提供一个 `/api/health`，部署到预览域名；不迁业务接口**。

先读：
- `AGENTS.md`
- `note.md` 顶部
- `wrangler.jsonc`
- `vite.config.ts`
- `package.json`
- `netlify/functions/health.ts`
- `netlify.toml`

任务：

1. 扩展 `wrangler.jsonc`：
   - `main: "worker/index.ts"`
   - `assets`：
     - `directory: "./dist"`
     - `not_found_handling: "single-page-application"`
     - `binding: "ASSETS"`
     - `run_worker_first: ["/api/*"]`
   - 保留阶段 0 的 `d1_databases`。
   - 加 `observability: { enabled: true }`（如果当前 wrangler 版本支持）。
   - `compatibility_date` 用当前日期；先不要加 `nodejs_compat`，本项目目标是去掉 Node-only 依赖。
2. 新增 `worker/index.ts`：
   - `export default { async fetch(request, env, ctx) { ... } }`。
   - `GET /api/health` 返回 `{ apify: Boolean(env.APIFY_TOKEN) }`，`Content-Type: application/json`，状态 200。
   - 其他 `/api/*` 暂时返回 501 JSON `{ error: "Not implemented" }`。
   - 非 `/api/*` 如果被调用，返回 `env.ASSETS.fetch(request)` 作为兜底。
3. 运行 `pnpm exec wrangler types`，生成 `worker-configuration.d.ts` 并让 `Env` 类型可用；不要手写 `D1Database` 类型。
4. 更新开发流程（二选一，优先 A）：
   - A. 加 `@cloudflare/vite-plugin`：`vite.config.ts` 加 `cloudflare()`；`pnpm dev` 同时跑 Vite + Worker；保留 `pnpm dev:netlify` 到阶段 5。若现有 `dev-api-scrape` middleware 与插件冲突，先保留 `/api/scrape` 中间件，删掉重复的 `/api/health` 中间件；阶段 2/3 再处理。
   - B. 不接插件，新增 `dev:worker: "wrangler dev"`；`pnpm dev` 仍只跑前端。阶段 2 再统一。
   不要为了本阶段重写前端。
5. 新增 `.dev.vars.example`：`APIFY_TOKEN=`、`TREG_TOKEN=`、`SCRAPE_PROVIDER=apify`；确认 `.dev.vars` 在 `.gitignore` 中。
6. 构建并部署预览：
   - `pnpm build`
   - `pnpm exec wrangler deploy --dry-run`
   - `pnpm exec wrangler deploy`
   - 只使用 `*.workers.dev` 预览域名，不绑生产域名。
7. 本地验证：
   - `pnpm dev` 或 `pnpm dev:worker` 能打开 SPA。
   - `curl -s http://127.0.0.1:8787/api/health` 返回 `{"apify":true}`（本地 `.dev.vars` 有 token 时）。
   - 预览域名能打开 SPA，`/api/health` 正常。

验收：
- `wrangler deploy --dry-run` 通过，bundle 里没有业务 handler。
- 预览域名 SPA 正常，`/api/health` 正常。
- 前端代码、`netlify/functions/*`、业务 API 未改。
- 生产 Netlify 域名仍然工作。

不要：
- 不要迁 auth/profiles/leads/admin/scrape。
- 不要删除 Netlify 或 `netlify.toml`。
- 不要绑定生产自定义域名。
- 不要加 `nodejs_compat` 来绕过依赖问题。

---

## 阶段 2：Worker + D1 全量业务接口（不含抓取）

### 提示词（可直接复制）

你是本项目（LinkedIn Insights Pro）的迁移工程师。阶段 0 已完成 D1 schema，阶段 1 已完成 Worker 骨架和 `/api/health`。现在做阶段 2：**把除抓取外的所有业务接口迁到 Worker + D1，保持路径和响应兼容；抓取接口暂时返回 501，阶段 3 完成**。

先读：
- `AGENTS.md`
- `note.md` 顶部
- `worker/index.ts`
- `db/schema.ts`
- `db/client.ts`
- `lib/auth-server.ts`
- `lib/quota-server.ts`
- `lib/validation.ts`
- `netlify/functions/*.ts`（逐个对照）
- `services/api.ts`（看前端期望的字段和错误处理）

任务：

1. 数据层：
   - 删除 `db/client.ts` 里的 `pg.Pool` / `node-postgres` / `process.env.DATABASE_URL`。
   - 统一使用阶段 0 的 `createDb(env.DB)`，每个请求创建一个 `AppDb`；不要模块级缓存 Drizzle 实例。
   - 保留 `db/schema.ts` 的类型导出，前端类型不受影响。
2. 认证：改 `lib/auth-server.ts`，所有函数显式接收 `db: AppDb`（或 `env`，二选一统一）：
   - `hashPassword` / `verifyPassword` 改为 async，用 WebCrypto PBKDF2（SHA-512、10000 轮、64 字节），保持输出格式 `salt:hash`，这样旧 hash 仍可验证。
   - `generateToken` 用 `crypto.getRandomValues(new Uint8Array(32))` 转 hex。
   - `createUser` 用 D1 `insert(...).returning()`；`user_roles` 插入失败要处理（可 `db.batch`）。
   - `verifyToken` 查 `sessions` + `users`，逻辑不变。
   - 更新所有调用点：`auth_signin`、`auth_signup`、`admin_create_user`、`admin_users`，以及 `scripts/create-admin-d1.mjs`。
3. 新增 Worker HTTP 辅助：
   - `worker/http.ts`：`json(data, status)`、`text(body, status)`、`parseJsonBody(request)`、`methodNotAllowed()`、`requireUser(request, db)`。
   - `worker/index.ts` 用显式路由表映射路径到 handler，路径必须和 `netlify.toml` 完全一致。
   - 所有 handler 改成 `(request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>`，不要再引入 Netlify `event` 适配层。
4. 迁移顺序（每完成一组就本地 smoke）：
   - `auth_*` + `admin_me`
   - `profiles_save/list/delete/update_ai`
   - `leads_list/save/delete/batch_delete` + `check_company_history`
   - `admin_toggles/quotas/create_user/users`
   - `health` 已在阶段 1
   - `/api/scrape`、`/api/scrape_company`、`/api/check_scrape_status` 本阶段返回 501，阶段 3 处理。
5. SQLite 查询修正：
   - `ilike` 不是 `sqlite-core` 操作符：改成 `like`（SQLite 对 ASCII 默认不区分大小写）；如果需要严格不区分大小写，用 `sql\`lower(${column}) LIKE ${pattern.toLowerCase()}\``。
   - `inArray` 在 `leads_batch_delete` 里按 90 个 id 一批，使用 `chunk()`；`check_scrape_status` 的 `inArray(profileUrls)` 阶段 3 也要切片。
   - `count()` 在 SQLite 返回 number，不是 PG 的 string；去掉多余转换。
   - `returning()`、`onConflictDoUpdate`、复合主键都可用；不要用交互式事务，需要原子多写就用 `db.batch()`。
   - `linkedin_profiles` / `linkedin_leads` 的时间字段仍按 ISO 字符串比较，不要改成 SQLite `CURRENT_TIMESTAMP` 格式。
6. 请求/响应兼容：
   - `event.httpMethod` → `request.method`。
   - `event.headers.authorization` → `request.headers.get('authorization')`。
   - `event.body` → `await parseJsonBody(request)`。
   - `event.queryStringParameters` → `new URL(request.url).searchParams`。
   - 保持状态码和错误文本语义；前端有 `res.text()` 和 `res.json()` 两种错误处理，尽量保持原样。
7. 依赖/类型：
   - 跑 `pnpm exec wrangler types`，Worker 代码用生成的 `Env`。
   - 顺手把 `zod` 升到 `>=4.5.0`（Cloudflare 文档建议，降低 Worker 内存），不要改校验语义。
8. 本地 smoke（用 `wrangler dev` + `curl` 或前端页面）：
   - 本地 D1 apply migration + seed admin。
   - `POST /api/auth/signup` 或 `signin` → 拿 token。
   - `GET /api/auth/me` → 200；无 token → 401。
   - `POST /api/profiles/save` → 200；`GET /api/profiles/list` 能看到；`POST /api/profiles/delete` 能删。
   - `POST /api/leads/save` → 200；`GET /api/leads/list` 能看到；`POST /api/leads/batch-delete` 能删。
   - `GET /api/check_company_history` → 200。
   - admin 账号下 `GET /api/admin/me`、`GET /api/admin/users`、`GET /api/admin/quotas` 正常。
   - 验证 `inArray` 超过 100 个 id 时按批切分，不报 D1 绑定参数错误。
9. 跑 `pnpm lint`、`pnpm test`、`pnpm build`、`pnpm exec wrangler deploy --dry-run`。

验收：
- 除 3 个抓取接口外，所有 `/api/*` 在 Worker + D1 上可用，返回字段和原 Netlify 版本一致。
- Worker bundle 里没有 `pg`、`node-postgres`、`process.env.DATABASE_URL`。
- 认证 hash 仍兼容 `salt:hash`，旧用户可登录。
- 浏览器端登录、保存 profile、列表、leads 列表/删除、admin 页面都能走通。
- 生产 Netlify 未动；预览 Worker 可用。

不要：
- 不要迁 `/api/scrape`、`/api/scrape_company`、`/api/check_scrape_status`（阶段 3）。
- 不要删除 Netlify 旧函数、`pg`、`apify-client`。
- 不要改前端 API 路径或字段名。
- 不要用 `db.transaction()`；D1 没有交互式事务。
- 不要为了省事把 `db` 放到模块级。

---

## 阶段 3：Apify SDK 改 REST

### 提示词（可直接复制）

你是本项目（LinkedIn Insights Pro）的迁移工程师。阶段 2 已完成 Worker + D1 的业务接口，抓取接口还是 501。现在做阶段 3：**在 Worker 里用 Apify REST API 实现三条抓取链路，移除 `apify-client` 在 Worker 路径中的使用；供应商仍是 Apify，不要切 treg**。

先读：
- `AGENTS.md`
- `note.md` 顶部
- `netlify/functions/scrape.ts`
- `netlify/functions/scrape_company.ts`
- `netlify/functions/check_scrape_status.ts`
- `services/apify.ts`
- `pages/Home.tsx`（看 runId 轮询和无 runId 同步分支）
- `lib/quota-server.ts`
- `db/schema.ts`（`scrape_jobs` 可选）

任务：

1. 新增 `worker/providers/types.ts`：
   - `ProfileScrapeInput`
   - `CompanyScrapeInput`（字段与 `ScrapeCompanyOptions` 对齐：`companyUrl`、`maxItems`、`profileScraperMode`、`jobTitles`、`locations`、`yearsAtCurrentCompanyIds`、`yearsOfExperienceIds`）
   - `ScrapeProvider` 接口：
     - `scrapeProfiles(input, env): Promise<any[]>`
     - `startCompanyScrape(input, env): Promise<{ runId: string }>`
     - `getCompanyScrape(runId, input, env): Promise<{ status: string; items?: any[]; stats?: any; error?: string }>`
   - 输出 item 保持 Apify dataset item 的字段结构，前端 `mapApifyToLinkedInProfile` 不改。
2. 新增 `worker/providers/apify.ts`，只用 `fetch`：
   - 启动：`POST https://api.apify.com/v2/acts/{actorId}/runs?token={APIFY_TOKEN}`，JSON body 为原输入。
   - 查询：`GET https://api.apify.com/v2/actor-runs/{runId}?token=...`。
   - Dataset：`GET https://api.apify.com/v2/datasets/{defaultDatasetId}/items?token=...&format=json&clean=true`。
   - 日志：当前 `check_scrape_status` 用 `client.run(runId).log().get()` 统计 "Scraped profile"；改成 Apify 对应的 REST log 端点。如果找不到稳定端点，可以去掉 log 计数，状态里只返回 run status 和已有 stats，前端仍能工作。
   - `scrapeProfiles`：原 `scrape.ts` 是同步 `.call()`。改成 start + 每 2 秒轮询，最多 120 秒；终态后拉 dataset items。超时返回 504 语义，错误信息保持可读。
   - `startCompanyScrape`：只 start，不等待；返回 `run.id`。
   - `getCompanyScrape`：get run；`RUNNING/READY` 返回运行中；`SUCCEEDED` 拉 items；`FAILED/ABORTED/TIMED-OUT` 返回错误。
3. 实现 Worker 三个路由（复用阶段 2 的鉴权、配额、D1）：
   - `POST /api/scrape`：鉴权 → 配额检查 → `scrapeProfiles` → 扣减 `monthly_usage` → 返回 items。
   - `POST /api/scrape_company`：鉴权 → 配额检查（按 `maxItems`）→ `startCompanyScrape` → 写 `scrape_jobs`（可选，但建议）→ 返回 `{ runId, status: 'RUNNING' }`。
   - `GET /api/check_scrape_status`：鉴权 → `getCompanyScrape` → 成功后做去重统计（复用原逻辑）→ 更新 `company_scrape_history` 和 `monthly_usage` → 返回 `{ status, items, stats }`。
   - 原输入/输出字段、状态码、错误文本尽量保持一致。
4. 配额和去重逻辑从 `netlify/functions/scrape*.ts` 原样迁过来，不要改业务规则。
5. 删除 Worker 路径里对 `apify-client` 的 import；但保留 `netlify/functions` 旧代码和 `package.json` 里的 `apify-client`，直到阶段 5。
6. 验证：
   - 本地 `wrangler dev`，用真实 `APIFY_TOKEN` 抓 1 个 profile。
   - 公司搜索用 1 个公司、`maxItems=3`、Full 模式，验证 start → poll → items。
   - 无 token / 无效 URL / 配额不足分别返回 401/400/429。
   - `pnpm exec wrangler deploy --dry-run`，检查 bundle 不含 `apify-client` 的 Node 依赖。
7. 跑 `pnpm lint`、`pnpm test`、`pnpm build`。

验收：
- 三个抓取接口在 Worker 上跑通，items 字段与原来一致。
- 前端 Profile 模式、Company 模式都能用；Company 轮询正常。
- Worker bundle 不引入 `apify-client`、`axios`、`proxy-agent`。
- 生产仍可用 Netlify；预览 Worker 可用。
- 仍默认 Apify，没有 treg 代码。

不要：
- 不要切 treg。
- 不要改前端。
- 不要改数据库 schema（除非 `scrape_jobs` 需要补字段，另开 migration）。
- 不要删除旧 Netlify 函数或 `apify-client` 依赖。
- 不要把 Apify token 暴露给前端；只在 Worker env 中使用。

---

## 阶段 4：treg provider + 灰度切换

### 提示词（可直接复制）

你是本项目（LinkedIn Insights Pro）的迁移工程师。阶段 3 已完成 Apify REST provider，默认仍走 Apify。现在做阶段 4：**新增 treg provider，保持 Apify 可回退，通过环境变量按链路切换；先灰度对比，不要直接删 Apify**。

先读：
- `AGENTS.md`
- `note.md` 顶部
- `worker/providers/types.ts`
- `worker/providers/apify.ts`
- `worker/handlers/scrape*.ts`
- `services/apify.ts`
- `pages/Home.tsx`（Company 模式支持无 `runId` 的同步分支）
- `db/schema.ts`（`scrape_jobs`、`company_scrape_history`）

背景与已确认事实：
- Profile 原 actor 是 dev_fusion `2SyF0bVxmgGr8IVCZ`，$0.01/result，自带 email/phone。
- Company 原 actor 是 HarvestAPI `Vb6LZkh4EqRlR0Ka9`，$0.02 start + $0.008/full、$0.012/full+email。
- treg 是 HTTP 代理/目录，不是 actor 平台；没有 runId/dataset/log。
- treg 直连 HarvestAPI 的价格（catalog observed）：
  - `harvestapi.linkedin.user.profile.main`：$0.004/call（basic）
  - `harvestapi.linkedin.user.profile`：$0.0064/call（full）
  - `harvestapi.linkedin.user.profile.email`：$0.02/call（full + email）
  - `harvestapi.linkedin.leads.search`：$0.05–$0.10/call，25 行/页
- treg 认证头是 `X-Treg-Token`，不是 `Authorization: Bearer`；REST 调用路径是 `https://treg.to/call/{endpoint_id}`。
- 不要用 `treg.linkedin.user.profile` 的 $0.0012 路由价来算 full profile；路由可能返回基础档案且 miss 可能计费。要确定性字段就直连 `harvestapi.*`。

任务：

1. 环境变量：
   - `TREG_TOKEN`
   - `SCRAPE_PROVIDER=apify|treg`（默认 `apify`）
   - 可选 `PROFILE_PROVIDER`、`COMPANY_PROVIDER`，用于按链路灰度；没有就用 `SCRAPE_PROVIDER`。
   - 更新 `.dev.vars.example`；不要提交真实 token。
2. 新增 `worker/providers/treg.ts`，实现 `ScrapeProvider`：
   - `tregCall(endpointId, { method, query, body, env, idempotencyKey })`：
     - URL：`https://treg.to/call/${endpointId}`；GET 把 query 拼到 URL；POST 发 JSON body。
     - headers：`X-Treg-Token`、`Content-Type: application/json`、`Idempotency-Key`（重试时复用同一个 key）。
     - 读取并记录 `X-Treg-Cost-Micro`、`X-Treg-Call-Id`；不要吞掉 provider 的错误 body。
   - Profile：
     - 输入 URL 列表；逐条调用 `harvestapi.linkedin.user.profile`（full）。
     - 如果 provider 模式是 Short，用 `.main`；如果包含 email，用 `.email`。
     - 映射 provider 的 `element`/`elements` 到现有 item 结构；保留 `raw_data`。
     - 并发限制 5；失败重试 1 次（带同一个 `Idempotency-Key`），仍失败则记录并跳过该 URL。
   - Company：
     - 第一步 `harvestapi.linkedin.leads.search`，参数映射：
       - `currentCompanies=companyUrl`
       - `locations=locations.join(',')`（最多 70）
       - `currentJobTitles=jobTitles.join(',')`（最多 70）
       - `yearsAtCurrentCompanyIds=...`
       - `yearsOfExperienceIds=...`
       - `page=1,2,...`；25 行/页；按 profile URL 去重，直到达到 `maxItems` 或没有更多行。
     - 第二步按 `profileScraperMode` 对每行补全：
       - `Short ($4 per 1k)` → `.main`
       - `Full ($8 per 1k)` → full
       - `Full + email ($12 per 1k)` 或包含 `email` → `.email`
     - 用 `mapLimit` 限制并发 5（HarvestAPI Starter 限制 5 concurrent，别超过）。
     - 第一版**优先同步返回** `{ items, stats }`，不返回 `runId`；`pages/Home.tsx` 已经支持无 `runId` 的同步分支。若实测 P95 > 60 秒或 `maxItems > 50`，再加 `scrape_jobs` + 分片轮询，保持前端契约。
3. 切换逻辑：
   - `worker/index.ts` 或 provider factory 根据 env 选择 Apify/Treg；默认 Apify。
   - 不要改前端 API 路径。
   - 如果 treg 某条链路失败，返回清晰错误，不要静默回退到 Apify（避免双重计费）；是否回退由 env 开关决定。
4. 成本与质量对比（必须做）：
   - 同一组 10 个 profile URL：Apify vs treg，记录字段完整性、email/phone、耗时、`X-Treg-Cost-Micro`。
   - 同一家公司、`maxItems=10`、Full 模式：Apify vs treg，记录 items 数、去重后数量、耗时、成本。
   - 输出一个简短对比表到 `note.md` 或 PR 描述；不要只凭 catalog 价格下结论。
5. 验收：
   - `SCRAPE_PROVIDER=apify` 时行为与阶段 3 完全一致。
   - `SCRAPE_PROVIDER=treg` 时 profile 和 company 两条链路都能返回可保存的 items。
   - Profile 的 `profile_url`、`full_name`、`headline`、`location`、`about`、`job_title`、`company_name`、`email`、`experiences`、`education`、`raw_data` 至少有等价字段。
   - Company 的过滤参数实际传到 `leads.search`；结果按 `maxItems` 截断并去重。
   - 并发不超过 5；失败重试不重复计费（Idempotency-Key）。
   - `pnpm lint`、`pnpm test`、`pnpm build`、`wrangler deploy --dry-run` 通过。
6. 检查 D1：
   - `scrape_jobs` 当前没有业务引用；如果实现轮询，补 `provider`、`provider_job_id`、`result_data` 等字段时另开 migration，不要直接改已有 migration。
   - 无论同步还是轮询，不要超过 D1 单行 2 MB；25 条 full profile 的 JSON 可能接近上限，必要时把 items 存到 R2 或分片存 `scrape_job_items`。

验收补充：
- 灰度只在预览环境；生产默认仍是 Apify，直到你确认切换。
- 保留 Apify provider 和 `SCRAPE_PROVIDER` 开关，阶段 5 只清理死代码，不删除可用回退。

不要：
- 不要删除 Apify provider 或 `apify-client` 依赖（阶段 5 再处理）。
- 不要把 treg token 暴露到前端。
- 不要把 `treg.linkedin.user.profile` 的路由价当作 full profile 价。
- 不要在没有对比数据的情况下把默认供应商切成 treg。
- 不要为了 treg 改前端字段名。

---

## 阶段 5：清理与收尾

### 提示词（可直接复制）

你是本项目（LinkedIn Insights Pro）的迁移工程师。阶段 0–4 已完成：Worker + D1 业务接口、Apify REST provider、treg provider + 灰度开关。现在做阶段 5：**在确认生产默认供应商后，清理 Netlify/Neon/旧 PG 代码和文档，只保留 Cloudflare 部署路径**。

先读：
- `AGENTS.md`
- `README.md`
- `note.md` 顶部
- `package.json`
- `netlify.toml`
- `drizzle.config.ts`
- `scripts/create-admin.js`
- `scripts/db-health.js`
- `.env.example`
- `wrangler.jsonc`

任务：

1. 确认切换决策：
   - 如果 treg 对比通过，把 `SCRAPE_PROVIDER` 默认设为 `treg`；否则保持 `apify`。
   - 保留另一个 provider 的实现和开关作为回退，不要删除 `worker/providers/*`。
2. 删除不再使用的 Netlify / Neon 代码：
   - `netlify.toml`
   - `netlify/functions/`（全部 22 个）
   - `netlify-cli` devDependency
   - `pg`、`@types/pg`
   - `drizzle-orm/node-postgres` 相关代码（如果还有）
   - `scripts/db-health.js`
   - 旧 `drizzle/` PG migration 目录（确认 `drizzle-d1/` 完整后）
   - `DATABASE_URL`、`JWT_SECRET` 的所有引用（`JWT_SECRET` 本来就没被代码使用）
   - `.env.local` 中的 Neon 配置不要提交，只更新 `.env.example`。
3. 依赖清理：
   - 删除 `apify-client` 包（如果 Apify provider 已改用 REST；保留 `worker/providers/apify.ts` 的 fetch 实现）。
   - 保留 `drizzle-orm`、`drizzle-kit`、`zod`、`wrangler`、`@cloudflare/vite-plugin`。
   - 检查 `vite.config.ts` 的 `dev-api-scrape` middleware（它只是旧的 `/api/scrape` 重复实现）；删除整段 middleware，因为 Worker 已经接管 `/api/*`。
   - 如果 `dotenv` 只被旧 `drizzle.config.ts` 使用，按新配置决定是否保留。
4. 脚本更新（`package.json`）：
   - `dev`：Vite + `@cloudflare/vite-plugin`（Worker + SPA）。
   - 删除 `dev:netlify`。
   - `build`：`vite build`。
   - `deploy`：`pnpm build && wrangler deploy`。
   - `db:generate`：`drizzle-kit generate`（sqlite / `drizzle-d1`）。
   - `db:migrate`：`wrangler d1 migrations apply DB --remote`。
   - `db:migrate:local`：`wrangler d1 migrations apply DB --local`。
   - `db:health`：改成 D1 检查（`wrangler d1 execute DB --remote --command "SELECT ..."`），或删除并在 README 写命令。
   - `create-admin`：指向新的 D1 seed 脚本。
5. 文档：
   - `README.md`：Cloudflare 部署步骤、`wrangler` 命令、D1 migration、`.dev.vars`、`wrangler secret put APIFY_TOKEN/TREG_TOKEN`、预览/生产域名、回滚说明。
   - `AGENTS.md`：更新架构、命令、文件命名、环境变量；删除 Netlify/Neon 相关段落。
   - `.env.example`：只保留 `APIFY_TOKEN`、`TREG_TOKEN`、`SCRAPE_PROVIDER`（以及必要的 `VITE_GEMINI_API_KEY`）；删除 `DATABASE_URL`、`JWT_SECRET`、`VITE_APIFY_TOKEN`。
   - `note.md`：保留阶段记录和对比结果，或在 README 链接。
6. 清理旧分支/回滚说明：
   - 不要删除 `main` 分支的 Netlify 配置；只在当前分支清理。
   - 在 README 写：回滚 = 切回 `main`，Cloudflare 预览可保留。
7. 验证：
   - `pnpm install --frozen-lockfile`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`
   - `pnpm exec wrangler deploy --dry-run`
   - 本地 `wrangler dev` 登录 → 保存 profile → 列表 → leads 列表/删除 → 抓取（按默认 provider）。
   - 预览部署 smoke。
   - `grep -R "DATABASE_URL\|JWT_SECRET\|netlify\|node-postgres\|apify-client"` 只应出现在 `note.md`/历史说明中，不应出现在运行代码里。

验收：
- 仓库只剩 Cloudflare Workers + D1 一套部署/数据层。
- 前端、API 路径、数据库字段、配额逻辑不变。
- 默认 provider 可切换；另一个 provider 仍可回退。
- 文档/脚本/env 示例与新架构一致。
- lint/test/build/deploy dry-run 全部通过。

不要：
- 不要删除当前分支的 `worker/providers/*` 回退实现。
- 不要动 `main` 分支的 Netlify 部署。
- 不要在没有确认 treg 对比结果前把默认切到 treg。
- 不要删除 `drizzle-d1/` 或 D1 数据。
- 不要把 `.dev.vars`、真实 token 提交到仓库。

---

## 建议的执行记录

每完成一个阶段，在 PR 描述或 `note.md` 里记录：
- 改了哪些文件
- 本地/预览验证命令与结果
- 仍未解决的问题
- 下一阶段的前置条件

阶段 4 额外记录：
- Apify vs treg 的 10 profile / 1 company 对比表（字段完整性、email/phone、耗时、成本）
- 默认 provider 的决策和回滚方式
