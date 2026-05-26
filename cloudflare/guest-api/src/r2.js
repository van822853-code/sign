function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function utf8(value) {
  return new TextEncoder().encode(value)
}

async function sha256Hex(value) {
  const hash = await crypto.subtle.digest('SHA-256', utf8(value))
  return toHex(new Uint8Array(hash))
}

async function hmacRaw(keyBytes, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, utf8(value))
  return new Uint8Array(signature)
}

async function deriveSigningKey(secretAccessKey, dateStamp, region, service) {
  const kDate = await hmacRaw(utf8(`AWS4${secretAccessKey}`), dateStamp)
  const kRegion = await hmacRaw(kDate, region)
  const kService = await hmacRaw(kRegion, service)
  return hmacRaw(kService, 'aws4_request')
}

function encodePathSegment(segment) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function canonicalUri(objectKey) {
  return `/${String(objectKey || '')
    .split('/')
    .map((segment) => encodePathSegment(segment))
    .join('/')}`
}

function canonicalQueryString(params) {
  return Object.entries(params)
    .flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((item) => [key, String(item)])
      }

      if (value === undefined || value === null || value === '') {
        return []
      }

      return [[key, String(value)]]
    })
    .map(([key, value]) => [encodePathSegment(key), encodePathSegment(value)])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey < rightKey) return -1
      if (leftKey > rightKey) return 1
      if (leftValue < rightValue) return -1
      if (leftValue > rightValue) return 1
      return 0
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
}

function formatAmzDate(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  const seconds = String(date.getUTCSeconds()).padStart(2, '0')

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

function formatDateStamp(date) {
  return formatAmzDate(date).slice(0, 8)
}

function normalizePrefix(prefix) {
  return String(prefix || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '')
}

function normalizeAccessKeyId(accessKeyId) {
  return String(accessKeyId || '')
    .trim()
    .replace(/-/g, '')
}

function normalizeSecretAccessKey(secretAccessKey) {
  return String(secretAccessKey || '')
    .trim()
    .replace(/-/g, '')
}

export function guessFileExtension(filename, contentType) {
  const byType = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
  }

  const type = String(contentType || '').toLowerCase()
  if (byType[type]) {
    return byType[type]
  }

  const match = String(filename || '').match(/\.([a-z0-9]+)$/i)
  if (!match) {
    return '.bin'
  }

  return `.${match[1].toLowerCase()}`
}

export function buildObjectKey({ prefix, uploadId, filename, contentType, createdAt }) {
  const date = new Date(createdAt || Date.now())
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const ext = guessFileExtension(filename, contentType)
  const cleanedPrefix = normalizePrefix(prefix)

  return [
    cleanedPrefix,
    year,
    month,
    uploadId,
    `original${ext}`,
  ]
    .filter(Boolean)
    .join('/')
}

export function buildPublicUrl(baseUrl, objectKey) {
  const cleanBase = normalizeBaseUrl(baseUrl)
  return `${cleanBase}/${String(objectKey || '').replace(/^\/+/, '')}`
}

export async function presignR2Url({
  method,
  accountId,
  accessKeyId,
  secretAccessKey,
  bucketName,
  objectKey,
  contentType,
  expiresInSeconds = 900,
  now = new Date(),
}) {
  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`
  const amzDate = formatAmzDate(now)
  const dateStamp = formatDateStamp(now)
  const region = 'auto'
  const service = 's3'
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const signedHeaders = contentType ? 'content-type;host' : 'host'
  const canonicalHeaders = contentType
    ? `content-type:${String(contentType).trim().toLowerCase()}\nhost:${host}\n`
    : `host:${host}\n`

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(Math.max(1, Math.min(604800, Number(expiresInSeconds) || 900))),
    'X-Amz-SignedHeaders': signedHeaders,
  }

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(objectKey),
    canonicalQueryString(queryParams),
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = await deriveSigningKey(secretAccessKey, dateStamp, region, service)
  const signature = toHex(new Uint8Array(await hmacRaw(signingKey, stringToSign)))
  const query = `${canonicalQueryString(queryParams)}&X-Amz-Signature=${signature}`

  return `https://${host}${canonicalUri(objectKey)}?${query}`
}

export function resolveR2Config(env) {
  const accountId = String(env.R2_ACCOUNT_ID || '').trim()
  const bucketName = String(env.R2_BUCKET_NAME || '').trim()
  const publicBaseUrl = String(env.R2_PUBLIC_BASE_URL || '').trim()
  const prefix = String(env.R2_KEY_PREFIX || 'prod/guests').trim()
  const expiresInSeconds = Number(env.R2_PRESIGN_EXPIRES_SECONDS || 900) || 900

  if (!accountId) {
    throw new Error('缺少 R2_ACCOUNT_ID')
  }

  if (!bucketName) {
    throw new Error('缺少 R2_BUCKET_NAME')
  }

  if (!publicBaseUrl) {
    throw new Error('缺少 R2_PUBLIC_BASE_URL')
  }

  return {
    accountId,
    bucketName,
    publicBaseUrl,
    prefix,
    expiresInSeconds,
  }
}

export async function createSignedUploadUrl(env, { objectKey, contentType }) {
  const config = resolveR2Config(env)

  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('缺少 R2_ACCESS_KEY_ID 或 R2_SECRET_ACCESS_KEY')
  }

  return presignR2Url({
    method: 'PUT',
    accountId: config.accountId,
    accessKeyId: normalizeAccessKeyId(env.R2_ACCESS_KEY_ID),
    secretAccessKey: normalizeSecretAccessKey(env.R2_SECRET_ACCESS_KEY),
    bucketName: config.bucketName,
    objectKey,
    contentType,
    expiresInSeconds: config.expiresInSeconds,
  })
}

export async function createSignedVerificationUrl(env, { method, objectKey }) {
  const config = resolveR2Config(env)

  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('缺少 R2_ACCESS_KEY_ID 或 R2_SECRET_ACCESS_KEY')
  }

  return presignR2Url({
    method,
    accountId: config.accountId,
    accessKeyId: normalizeAccessKeyId(env.R2_ACCESS_KEY_ID),
    secretAccessKey: normalizeSecretAccessKey(env.R2_SECRET_ACCESS_KEY),
    bucketName: config.bucketName,
    objectKey,
    expiresInSeconds: 300,
  })
}

export async function verifyObjectExists(env, { objectKey }) {
  const url = await createSignedVerificationUrl(env, {
    method: 'HEAD',
    objectKey,
  })

  const response = await fetch(url, { method: 'HEAD' })
  if (!response.ok) {
    const error = new Error('对象尚未写入 R2')
    error.status = response.status === 404 ? 409 : 502
    throw error
  }

  return {
    etag: response.headers.get('etag'),
    sizeBytes: Number(response.headers.get('content-length') || 0) || null,
  }
}

export async function deleteObjectFromR2(env, { objectKey }) {
  const url = await createSignedVerificationUrl(env, {
    method: 'DELETE',
    objectKey,
  })

  const response = await fetch(url, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    const error = new Error('删除 R2 对象失败')
    error.status = 502
    throw error
  }

  return true
}
