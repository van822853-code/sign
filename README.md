# Ensemble Sign

活动来宾端页面。前端通过 Cloudflare Worker 提供的公开 API 读取活动内容、上传头像，并写入来宾记录。

- `GET /api/posters/active`
- `GET /api/program`
- `GET /api/works`
- `POST /api/uploads/init`
- `POST /api/uploads/complete`
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
- 可选：`VITE_UPLOAD_API_BASE`

## Guest payload

来宾登记仅提交以下字段：

- `name`
- `role`
- `photo`

当前页面使用后置摄像头拍摄头像或选择本地图片，前端保留 `File` 对象，不转 base64，直接走 Worker 发放的 R2 presigned URL。

上传顺序：

1. `POST /api/uploads/init`
2. 将 `File` 上传到返回的 `uploadURL`
3. `POST /api/uploads/complete`
4. `POST /api/guests`
5. `GET /api/guests`

`POST /api/guests` 只写入 `name`、`role`、`photo`，其中 `photo` 使用 R2 公开读 URL。来宾头像状态通过 `GET /api/guests` 获取并渲染，最终显示返回的 `photo` 字段。

## Local

1. `npm install`
2. Configure `.env.local` from `.env.example`
3. In another terminal, run `npm run worker:dev`
4. `npm run dev`
