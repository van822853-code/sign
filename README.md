# Ensemble Sign

活动来宾端页面，直接读取并写入活动后端公开 API：

- `GET /api/posters/active`
- `GET /api/program`
- `GET /api/works`
- `POST /api/uploads/init`
- `POST /api/uploads/complete`
- `GET /api/guests`
- `POST /api/guests`

默认后端地址：

- `https://show-plan-event-backend.liucheng-show-plan.workers.dev`

## Guest payload

来宾登记仅提交以下字段：

- `name`
- `role`
- `photo`

当前页面使用后置摄像头拍摄头像或选择本地图片，前端保留 `File` 对象，不转 base64，不走临时图床。

上传顺序：

1. `POST /api/uploads/init`
2. 将 `File` 上传到返回的 `uploadURL`
3. `POST /api/uploads/complete`
4. `POST /api/guests`
5. `GET /api/guests`

`POST /api/guests` 只写入 `name`、`role`、`photo`，其中 `photo` 使用 Cloudflare 返回的图片 URL 或 key。来宾头像状态通过 `GET /api/guests` 获取并渲染，最终显示返回的 `photo` 字段。

## Local

1. `npm install`
2. Configure `.env.local` from `.env.example`
3. `npm run dev`
