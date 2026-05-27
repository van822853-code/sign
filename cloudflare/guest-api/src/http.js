const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Checkin-Device-Id',
  'Access-Control-Max-Age': '86400',
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function jsonResponse(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

export function textResponse(data, { status = 200, headers = {} } = {}) {
  return new Response(data, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      ...headers,
    },
  })
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function readJsonBody(request) {
  const raw = await request.text()
  if (!raw.trim()) {
    return {}
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new HttpError(400, 'invalid_json')
  }
}

export function toErrorResponse(error) {
  const status = Number(error?.status || error?.statusCode || 500)
  const message =
    error instanceof HttpError
      ? String(error.message || 'error')
      : error instanceof Error
        ? error.message || 'internal_error'
        : 'internal_error'

  return jsonResponse({ error: message }, { status })
}

export function toLowerTrim(value) {
  return String(value || '').trim().toLowerCase()
}

export function trimString(value) {
  return String(value || '').trim()
}
