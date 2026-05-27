const DEFAULT_EVENT_API_BASE = import.meta.env.DEV
  ? 'http://127.0.0.1:8787'
  : 'https://ensemble-guest-api.saintmob.workers.dev'
const DEV_EVENT_API_BASES = ['http://127.0.0.1:8787', 'http://127.0.0.1:8788']
const EXPLICIT_EVENT_API_BASE = normalizeBase(import.meta.env.VITE_EVENT_API_BASE)
const CONFIGURED_EVENT_API_BASE = EXPLICIT_EVENT_API_BASE || DEFAULT_EVENT_API_BASE
const CHECKIN_DEVICE_ID_STORAGE_KEY = 'show-plan-checkin-device-id'

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

function getStoredValue(key) {
  try {
    return window.localStorage.getItem(key) || window.sessionStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function setStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, value)
    return
  } catch {
    try {
      window.sessionStorage.setItem(key, value)
    } catch {
      // Ignore storage failures and fall back to an in-memory value.
    }
  }
}

export function getCheckInDeviceId() {
  if (typeof window === 'undefined') {
    return ''
  }

  const existing = getStoredValue(CHECKIN_DEVICE_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const deviceId = crypto.randomUUID()
  setStoredValue(CHECKIN_DEVICE_ID_STORAGE_KEY, deviceId)
  return deviceId
}

function withCheckInDeviceId(headers = {}, deviceId) {
  if (!deviceId) {
    return headers
  }

  return {
    ...headers,
    'X-Checkin-Device-Id': deviceId,
  }
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

export async function fetchEventBootstrap() {
  const data = await request('/api/bootstrap')
  return {
    poster: data?.poster ?? null,
    program: data?.program ?? null,
    works: data?.works ?? [],
    guests: data?.guests ?? [],
  }
}

export async function createGuest(entry, deviceId = getCheckInDeviceId()) {
  const isFileUpload = typeof File !== 'undefined' && entry.photo instanceof File

  const requestOptions = {
    method: 'POST',
    headers: withCheckInDeviceId(
      isFileUpload
        ? {}
        : {
            'Content-Type': 'application/json',
          },
      deviceId,
    ),
  }

  if (isFileUpload) {
    const formData = new FormData()
    formData.append('name', entry.name)
    formData.append('role', entry.role)
    formData.append('file', entry.photo, entry.photo.name)
    formData.append('fileName', entry.photo.name)
    formData.append('filename', entry.photo.name)
    formData.append('contentType', entry.photo.type || 'application/octet-stream')
    formData.append('mimeType', entry.photo.type || 'application/octet-stream')
    formData.append('size', String(entry.photo.size))
    formData.append(
      'metadata',
      JSON.stringify({
        purpose: 'guest-avatar',
        fileName: entry.photo.name,
        filename: entry.photo.name,
        contentType: entry.photo.type || 'application/octet-stream',
        mimeType: entry.photo.type || 'application/octet-stream',
        size: entry.photo.size,
      }),
    )
    requestOptions.body = formData
  } else {
    requestOptions.body = JSON.stringify({
      name: entry.name,
      role: entry.role,
      photo: entry.photo,
    })
  }

  const response = await request('/api/guests', requestOptions)

  return response.guest ?? response
}
