const DEFAULT_EVENT_API_BASE =
  'https://show-plan-event-backend.liucheng-show-plan.workers.dev'

const API_BASE = (import.meta.env.VITE_EVENT_API_BASE || DEFAULT_EVENT_API_BASE).replace(
  /\/$/,
  '',
)

async function parseResponse(response) {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.error || '请求失败')
  }
  return data
}

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, options)
  return parseResponse(response)
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return ''
}

export async function fetchActivePoster() {
  const data = await request('/api/posters/active')
  return data.poster ?? null
}

export async function fetchProgram() {
  const data = await request('/api/program')
  return data.program ?? null
}

export async function fetchWorks() {
  const data = await request('/api/works')
  return data.works ?? []
}

export async function fetchGuests() {
  const data = await request('/api/guests')
  return data.guests ?? []
}

export async function initGuestAvatarUpload(file) {
  const data = await request('/api/uploads/init', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      purpose: 'guest-avatar',
      fileName: file.name,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  })

  return data.upload ?? data.result ?? data
}

async function uploadFileToDestination(upload, file) {
  const uploadURL = pickFirst(upload.uploadURL, upload.uploadUrl, upload.url)
  if (!uploadURL) {
    throw new Error('缺少上传地址')
  }

  const method = String(
    pickFirst(upload.method, upload.httpMethod, upload.uploadMethod, upload.formMethod, upload.fields ? 'POST' : 'PUT'),
  ).toUpperCase()

  if (upload.fields && typeof upload.fields === 'object') {
    const formData = new FormData()
    for (const [key, value] of Object.entries(upload.fields)) {
      formData.append(key, value)
    }
    formData.append(upload.fileField || upload.fileFieldName || 'file', file, file.name)

    const response = await fetch(uploadURL, {
      method,
      body: formData,
    })

    if (!response.ok) {
      throw new Error('头像上传失败，请重试')
    }

    return response
  }

  const headers = new Headers(upload.headers || {})
  if (!headers.has('Content-Type') && file.type) {
    headers.set('Content-Type', file.type)
  }

  const response = await fetch(uploadURL, {
    method,
    headers,
    body: file,
  })

  if (!response.ok) {
    throw new Error('头像上传失败，请重试')
  }

  return response
}

export async function completeGuestAvatarUpload(upload, file) {
  const data = await request('/api/uploads/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      purpose: 'guest-avatar',
      uploadId: pickFirst(upload.uploadId, upload.id),
      key: upload.key,
      fileName: file.name,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      publicUrl: pickFirst(upload.publicUrl, upload.publicURL, upload.url),
    }),
  })

  return data.upload ?? data.result ?? data
}

export async function uploadGuestAvatar(file) {
  const init = await initGuestAvatarUpload(file)
  await uploadFileToDestination(init, file)
  const completed = await completeGuestAvatarUpload(init, file)

  return pickFirst(
    completed.photo,
    completed.publicUrl,
    completed.publicURL,
    completed.url,
    completed.photoUrl,
    completed.key,
    init.publicUrl,
    init.publicURL,
    init.url,
    init.key,
  )
}

export async function createGuest(entry) {
  const response = await request('/api/guests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: entry.name,
      role: entry.role,
      photo: entry.photo,
    }),
  })

  return response.guest ?? response
}
