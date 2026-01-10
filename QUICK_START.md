# 🚀 快速启动指南

## ✅ 迁移已完成

恭喜！您的应用已成功从 Supabase 迁移到 Neon PostgreSQL，并实现了自定义 JWT 认证系统。

## 📋 当前状态

- ✅ 数据库：Neon PostgreSQL
- ✅ 认证系统：自定义 JWT
- ✅ 所有表已创建
- ✅ 管理员账户已创建
- ✅ 应用正在运行：http://localhost:5174/

## 🔑 默认管理员账户

```
Email: admin@example.com
Password: admin123
```

**⚠️ 重要**: 请立即登录并修改密码！

## 🎯 快速测试

### 1. 登录测试

1. 打开浏览器访问：http://localhost:5174/
2. 点击 "Login"
3. 使用上面的管理员账户登录
4. 应该能看到 Dashboard

### 2. 创建新用户（管理员功能）

1. 登录后，点击顶部导航的 "Admin"
2. 在 "Create User" 部分输入新用户信息
3. 点击 "Create User"

### 3. 设置配额（管理员功能）

1. 在 Admin 页面的 "Set Quota" 部分
2. 输入用户 ID 和每日限额
3. 点击 "Set Quota"

### 4. 测试 Profile 功能

1. 点击 "Profiles" 查看所有 profiles
2. 点击 "Dashboard" 返回主页
3. 输入 LinkedIn URL 进行抓取（需要 Apify 配额）

## 🛠️ 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 数据库相关
npm run db:generate  # 生成迁移文件
npx drizzle-kit push # 推送到数据库
npm run db:studio    # 打开 Drizzle Studio
npm run db:health    # 检查数据库连接

# 创建管理员用户
node scripts/create-admin.js <email> <password>
```

## 📁 项目结构

```
├── lib/
│   ├── auth.ts              # 前端认证客户端
│   └── auth-server.ts       # 后端认证工具
├── db/
│   ├── schema.ts            # 数据库 Schema
│   └── client.ts            # 数据库连接
├── netlify/functions/
│   ├── auth_*.ts            # 认证 API
│   ├── profiles_*.ts        # Profiles API
│   ├── admin_*.ts           # Admin API
│   └── scrape.ts            # LinkedIn 抓取
├── services/
│   ├── auth.ts              # 认证服务
│   ├── supabase.ts          # Profile 服务（已更新）
│   ├── admin.ts             # Admin 服务
│   └── apify.ts             # Apify 服务
└── pages/
    ├── Login.tsx            # 登录页面
    ├── Dashboard.tsx        # 仪表板
    ├── Profiles.tsx         # Profiles 列表
    └── Admin.tsx            # 管理员页面
```

## 🔐 安全提示

1. **修改 JWT_SECRET**
   - 在 `.env.local` 中设置强随机字符串（至少 32 字符）
   - 生产环境必须使用不同的密钥

2. **修改管理员密码**
   - 首次登录后立即修改
   - 使用强密码

3. **环境变量保护**
   - 不要将 `.env.local` 提交到 Git
   - 在生产环境使用环境变量管理工具

## 🐛 常见问题

### 无法登录

- 清除浏览器 localStorage：`localStorage.clear()`
- 检查数据库连接：`npm run db:health`
- 查看浏览器控制台错误

### 数据库连接失败

- 检查 `.env.local` 中的 `DATABASE_URL`
- 确认 Neon 数据库在线
- 测试连接：`npm run db:health`

### API 请求失败

- 检查 Netlify Functions 是否正常运行
- 查看浏览器 Network 标签
- 检查认证 token 是否有效

## 📚 API 文档

### 认证 API

- `POST /api/auth/signin` - 登录
- `POST /api/auth/signup` - 注册
- `POST /api/auth/signout` - 登出
- `GET /api/auth/me` - 获取当前用户

### Profiles API

- `GET /api/profiles/list` - 列出所有 profiles
- `POST /api/profiles/save` - 保存 profile
- `POST /api/profiles/delete` - 删除 profile
- `POST /api/profiles/update-ai` - 更新 AI 摘要

### Admin API

- `GET /api/admin/me` - 获取用户角色
- `POST /api/admin/create-user` - 创建用户
- `GET /api/admin/quotas` - 获取配额
- `POST /api/admin/quotas` - 设置配额
- `GET /api/admin/toggles` - 获取系统开关
- `POST /api/admin/toggles` - 设置系统开关

## 🎉 下一步

1. ✅ 测试所有功能
2. ✅ 修改管理员密码
3. ✅ 设置强 JWT_SECRET
4. 📝 创建普通用户账户
5. 📝 设置 Apify 配额
6. 📝 开始使用 LinkedIn 抓取功能

## 📖 更多文档

- `MIGRATION_NOTES.md` - 详细迁移说明
- `MIGRATION_COMPLETE.md` - 迁移完成总结
- `README.md` - 项目说明

---

**迁移完成时间**: 2025-12-18  
**数据库**: Neon PostgreSQL  
**认证**: 自定义 JWT  
**状态**: ✅ 成功运行
