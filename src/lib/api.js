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

export async function createGuest(entry) {
  const response = await request('/api/guests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fullName: entry.fullName,
      identity: entry.identity,
      photo: entry.selfieThumbnailUrl || entry.selfieUrl || entry.photo || '',
      selfieUrl: entry.selfieUrl,
      selfieThumbnailUrl: entry.selfieThumbnailUrl,
    }),
  })

  return response.guest ?? response
}
