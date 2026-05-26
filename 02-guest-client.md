# 02-guest-client

来宾端签到信息统一由 Cloudflare 上的后端提供。

## 接口

### 来宾头像上传

`POST /api/uploads/init`

`POST /api/uploads/complete`

头像上传流程：

1. 前端拿到来宾头像 `File`。
2. 调用 `POST /api/uploads/init`，传 `purpose: "guest-avatar"`、文件名、文件类型和大小。
3. 后端返回 Cloudflare 上传所需信息，例如 `uploadURL`、`uploadId`、`key` 或 `publicUrl`。
4. 前端将 `File` 上传到 `uploadURL`。
5. 上传成功后调用 `POST /api/uploads/complete`，传 `uploadId`、`key` 等信息。
6. 后端返回最终可访问的 `photo` URL 或 `photo` key。

### 来宾签到

`POST /api/guests`

`Content-Type: application/json`

请求体：

```json
{
  "name": "张三",
  "role": "老师",
  "photo": "https://example.com/guest-avatar.jpg"
}
```

### 来宾头像状态

`GET /api/guests`

返回来宾列表和当前头像状态，前端直接渲染 `photo` 字段。

## 约定

- 前端只保留头像 `File` 对象，不转 base64，不走临时图床。
- 上传顺序必须是：
  - `POST /api/uploads/init`
  - Cloudflare upload request
  - `POST /api/uploads/complete`
  - `POST /api/guests`
  - `GET /api/guests`
- 页面展示和列表展示都读取 `GET /api/guests` 返回的 `photo`。
