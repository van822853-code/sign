# Guest API Worker

这个目录是来宾端的 Cloudflare Worker 后端。

## 存储分层

- 来宾记录、节目、海报、作品：Cloudflare D1
- 头像文件：外部 Cloudflare R2
- 前端页面：仓库根目录里的 Vite 应用

## 目录结构

- `src/index.js`: 路由入口
- `src/db.js`: D1 读写
- `src/r2.js`: 外部 R2 presigned URL 和对象校验
- `src/http.js`: JSON、CORS、错误响应
- `migrations/0001_init.sql`: 数据表结构

## 初始化

1. 安装依赖

   ```bash
   cd cloudflare/guest-api
   npm install
   ```

2. 创建或绑定 D1

   ```bash
   npx wrangler d1 create guest_avatars
   ```

   如果你已经在控制台里创建好了同名数据库，就直接把 `database_id` 填到 `wrangler.jsonc` 里。

3. 配置外部 R2 凭据

   ```bash
   cp .dev.vars.example .dev.vars
   ```

   然后补全：

   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`

   如果你拿到的是一串合并后的 `R2 KEY`，可以按 `accessKeyId-secretAccessKey` 的形式拆成两段填入。

4. 应用迁移

   ```bash
   npx wrangler d1 migrations apply DB --local
   ```

5. 启动本地 Worker

   ```bash
   npm run dev
   ```

## API

- `GET /api/posters/active`
- `GET /api/program`
- `GET /api/works`
- `GET /api/guests`
- `POST /api/guests`
- `POST /api/uploads/init`
- `POST /api/uploads/complete`
- `GET /api/uploads/:uploadId`
- `DELETE /api/uploads/:uploadId`

## 前端配置

根目录前端读取：

- `VITE_EVENT_API_BASE`
- 可选：`VITE_UPLOAD_API_BASE`

本地开发时，默认可以指向 `http://127.0.0.1:8787`。
