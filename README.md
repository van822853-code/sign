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
- `photo`

当前页面使用后置摄像头拍摄头像，提交时会把拍摄结果以图片数据提交给后端，不再要求填写 HTTPS 图片链接。

## Local

1. `npm install`
2. Configure `.env.local` from `.env.example`
3. `npm run dev`
