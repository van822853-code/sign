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
- `GET /api/bootstrap?guestLimit=28`
- `GET /api/guests?limit=28`
- `POST /api/guests`

## 前端配置

根目录前端读取：

- `VITE_EVENT_API_BASE`

本地开发时，默认可以指向 `http://127.0.0.1:8787`。
生产环境默认已指向 `https://ensemble-guest-api.saintmob.workers.dev`，如需切换再覆盖此变量。

当前前端上传流程由 Worker 代传文件，浏览器不再直接请求 R2 直连域名。
前端主流程直接调用 `POST /api/guests`，并由 Worker 在同一次请求里完成头像上传和来宾写入。
前端入口优先调用 `GET /api/bootstrap?guestLimit=28` 汇总海报、节目、作品、最新来宾和来宾总数，避免轮询 4 个单独接口，也避免首屏拉取全量历史来宾。
入口页不再有固定间隔的自动轮询，只在首次加载、手动刷新、或切回前台且数据足够旧时才重新拉取。

`GET /api/bootstrap` 和静态读接口会返回适合浏览器缓存的响应头，以减少重复网络请求；`GET /api/guests` 支持 `limit` 并保持 `no-store`，避免提交后的名单被浏览器缓存住。两个来宾列表响应都会返回 `guestCount`/`totalGuests`，用于前端在只展示最新来宾时仍显示准确总人数。

## 访问控制

公开登记链路现在很简单：

- `POST /api/guests` 由前端自动带设备标识，Worker 按“每台设备每天 100 次”计数
- 同一请求既可以是 JSON，也可以是 `multipart/form-data`
- 传文件时，Worker 会在写入来宾前先把头像上传到 R2

## 上传限制

- 头像文件上限：5MB
- 超出会在前端先拦截，Worker 侧也会再次校验

## 提交限制

- 每台设备每天最多 100 次提交
- 设备标识由前端自动生成并保存在本地
