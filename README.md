# Ensemble Sign

活动来宾端页面。前端通过 Cloudflare Worker 提供的公开 API 读取活动内容、上传头像，并写入来宾记录。

- `GET /api/posters/active`
- `GET /api/program`
- `GET /api/works`
- `POST /api/uploads/proxy`
- `POST /api/uploads/init` (legacy)
- `POST /api/uploads/complete` (legacy)
- `GET /api/uploads/:uploadId`
- `DELETE /api/uploads/:uploadId`
- `GET /api/guests`
- `POST /api/guests`

Worker 后端在：

- [`cloudflare/guest-api`](./cloudflare/guest-api)

存储分层：

- 来宾记录和活动内容：Cloudflare D1
- 头像文件：外部 Cloudflare R2
- 前端本地缓存：`localStorage`

前端只需要配置 Worker API base：

- `VITE_EVENT_API_BASE`

本地开发时可以指向 `http://127.0.0.1:8787`。生产环境默认已经硬编码指向公开 Worker 地址，如需改到别的 Worker，再用这个变量覆盖。

当前上传流程和活动 API 走同一个 Worker，不再需要单独的上传 base。

## Guest payload

来宾登记仅提交以下字段：

- `name`
- `role`
- `photo`

当前页面使用后置摄像头拍摄头像或选择本地图片，前端保留 `File` 对象，不转 base64，直接把文件交给 Worker，由 Worker 完成后续上传。

当前版本改为由 Worker 代上传，不再让浏览器直连 R2。上传顺序：

1. `POST /api/uploads/proxy`
2. `POST /api/guests`
3. `GET /api/guests`

`POST /api/guests` 只写入 `name`、`role`、`photo`，其中 `photo` 使用 R2 公开读 URL。来宾头像状态通过 `GET /api/guests` 获取并渲染，最终显示返回的 `photo` 字段。

## Local

1. `npm install`
2. Configure `.env.local` from `.env.example`
3. In another terminal, run `npm run worker:dev`
4. `npm run dev`
