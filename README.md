# Ensemble Sign

活动来宾端页面。前端通过 Cloudflare Worker 提供的公开 API 读取活动内容、上传头像，并写入来宾记录。

- `GET /api/posters/active`
- `GET /api/program`
- `GET /api/works`
- `GET /api/bootstrap`
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

本地开发时可以指向 `http://127.0.0.1:8787`。生产环境默认已经硬编码指向 `https://ensemble-guest-api.saintmob.workers.dev`，如需改到别的 Worker，再用这个变量覆盖。

当前上传流程和活动 API 走同一个 Worker，不再需要单独的上传 base。页面入口会优先调用 `GET /api/bootstrap?guestLimit=28` 一次性拉取海报、节目、作品、最新来宾和来宾总数，避免分别请求四个接口，也避免首屏拉取全量历史来宾。
入口页不再做固定间隔轮询，只在首次进入、手动刷新、或者切回前台且数据足够旧时重新拉取。

## Guest payload

来宾登记仅提交以下字段：

- `name`
- `role`
- `photo`

当前页面使用后置摄像头拍摄头像或选择本地图片，前端保留 `File` 对象，不转 base64，直接把文件交给 Worker，由 Worker 完成后续上传。

当前版本由 Worker 统一处理登记提交，不再让浏览器直连 R2。前端只需要一次 `POST /api/guests`：

- 传 JSON 时：提交 `name`、`role`、`photo`（已上传头像 URL）
- 传 `multipart/form-data` 时：直接提交 `name`、`role`、`file`，Worker 会负责上传头像并创建来宾

`POST /api/guests` 仍然会返回 `guest`。来宾列表读取接口支持 `limit`，例如 `GET /api/guests?limit=28` 返回最新来宾和 `guestCount`/`totalGuests`，最终头像显示使用返回的 `photo` 字段。

头像文件上限为 5MB，超出会在前端和 Worker 双侧一起拦截。
每台设备每天最多 100 次提交，前端会自动带上本地生成的设备标识。

## Local

1. `npm install`
2. Configure `.env.local` from `.env.example`
3. In another terminal, run `npm run worker:dev`
4. `npm run dev`
