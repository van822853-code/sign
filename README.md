# Ensemble Sign

活动来宾端页面，直接读取并写入活动后端公开 API：

- `GET /api/posters/active`
- `GET /api/program`
- `GET /api/works`
- `GET /api/guests`
- `POST /api/guests`

默认后端地址：

- `https://show-plan-event-backend.liucheng-show-plan.workers.dev`

## Guest payload

来宾登记仅提交以下字段：

- `fullName`
- `identity`
- `selfieUrl`
- `selfieThumbnailUrl`

后端不接受 base64 图片。当前页面以 HTTPS 图片 URL 作为提交来源；摄像头拍照仅用于当前设备预览，不提供本地文件上传入口。

## Local

1. `npm install`
2. Configure `.env.local` from `.env.example`
3. `npm run dev`
