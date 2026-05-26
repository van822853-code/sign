const DEFAULT_EVENT_API_BASE = import.meta.env.DEV
  ? 'http://127.0.0.1:8787'
  : 'https://ensemble-guest-api.saintmob.workers.dev'
const DEV_EVENT_API_BASES = ['http://127.0.0.1:8787', 'http://127.0.0.1:8788']
const EXPLICIT_EVENT_API_BASE = normalizeBase(import.meta.env.VITE_EVENT_API_BASE)
const CONFIGURED_EVENT_API_BASE = EXPLICIT_EVENT_API_BASE || DEFAULT_EVENT_API_BASE

function normalizeBase(value) {
  return String(value || '')
    .trim()
    .replace(/\/$/, '')
}

function buildApiUrl(base, path) {
  return base ? `${base}${path}` : path
}

function getApiBaseCandidates(base) {
  if (base) {
    return [base]
  }

  if (import.meta.env.DEV) {
    return DEV_EVENT_API_BASES
  }

  return []
}

async function fetchFromCandidateBases(path, options, bases) {
  if (bases.length === 0) {
    throw new Error('未配置 Worker API 地址')
  }

  let lastError = null

  for (const base of bases) {
    try {
      const response = await fetch(buildApiUrl(base, path), options)
      return response
    } catch (error) {
      lastError = error
    }
  }

  throw lastError || new Error('请求失败')
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || `请求失败 (${response.status})`)
  }
  return data
}

async function request(path, options) {
  const response = await fetchFromCandidateBases(
    path,
    options,
    getApiBaseCandidates(CONFIGURED_EVENT_API_BASE),
  )
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
  return data?.poster ?? null
}

export async function fetchProgram() {
  const data = await request('/api/program')
  return data?.program ?? null
}

export async function fetchWorks() {
  const data = await request('/api/works')
  return data?.works ?? []
}

export async function fetchGuests() {
  const data = await request('/api/guests')
  return data?.guests ?? []
}

export async function uploadGuestAvatar(file) {
  const formData = new FormData()
  formData.append('purpose', 'guest-avatar')
  formData.append('file', file, file.name)
  formData.append('fileName', file.name)
  formData.append('filename', file.name)
  formData.append('contentType', file.type || 'application/octet-stream')
  formData.append('mimeType', file.type || 'application/octet-stream')
  formData.append('size', String(file.size))
  formData.append(
    'metadata',
    JSON.stringify({
      purpose: 'guest-avatar',
      fileName: file.name,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    }),
  )

  const data = await request('/api/uploads/proxy', {
    method: 'POST',
    body: formData,
  })

  const completed = data?.upload ?? data?.result ?? data
  if (!completed) {
    throw new Error('头像上传失败，请确认 Worker 地址已配置')
  }

  return pickFirst(
    completed.photo,
    completed.publicUrl,
    completed.publicURL,
    completed.url,
    completed.photoUrl,
    completed.key,
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
