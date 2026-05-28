import {
  bumpDeviceDailyLimit,
  completeUploadRecord,
  countGuests,
  createGuest,
  createUploadRecord,
  deleteUploadRecord,
  getActiveContentItem,
  listContentItems,
  listGuests,
  uploadRowToResponse,
} from './db.js'
import {
  buildObjectKey,
  buildPublicUrl,
  deleteObjectFromR2,
  resolveR2Config,
  verifyObjectExists,
  uploadObjectToR2,
} from './r2.js'
import {
  cacheControlHeader,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody,
  textResponse,
  toErrorResponse,
  toLowerTrim,
  trimString,
} from './http.js'

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readBoundedInteger(value, fallback, max) {
  return Math.min(readPositiveInteger(value, fallback), max)
}

const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const CHECKIN_DEVICE_DAILY_LIMIT = 100
const DEFAULT_BOOTSTRAP_GUEST_LIMIT = 28
const MAX_GUEST_LIST_LIMIT = 200

function ensureImageContentType(contentType) {
  const normalized = toLowerTrim(contentType)
  if (!normalized.startsWith('image/')) {
    throw new HttpError(415, 'invalid_content_type')
  }
  return normalized
}

function parseMetadataField(value) {
  if (value === undefined || value === null || value === '') {
    return {}
  }

  if (typeof value !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    throw new HttpError(400, 'invalid_metadata')
  }
}

function readFormFile(formData) {
  const file = formData.get('file')
  if (!(file instanceof File)) {
    throw new HttpError(400, 'invalid_file')
  }

  return file
}

function readUploadInputFromForm(formData) {
  const file = readFormFile(formData)
  const filename = trimString(
    formData.get('fileName') || formData.get('filename') || formData.get('name') || file.name,
  )
  const contentType = ensureImageContentType(
    formData.get('contentType') || formData.get('mimeType') || file.type,
  )
  const sizeBytes = readPositiveInteger(
    formData.get('sizeBytes') || formData.get('size') || formData.get('fileSize') || file.size,
    0,
  )
  const purpose = trimString(formData.get('purpose')) || 'guest-avatar'
  const externalUserId = trimString(formData.get('externalUserId') || formData.get('userId'))
  const metadata = parseMetadataField(formData.get('metadata'))

  if (!filename) {
    throw new HttpError(400, 'invalid_filename')
  }

  if (!sizeBytes) {
    throw new HttpError(400, 'invalid_size')
  }

  return {
    file,
    filename,
    contentType,
    sizeBytes,
    purpose,
    externalUserId,
    metadata,
  }
}

async function prepareUploadRecord(env, {
  filename,
  contentType,
  sizeBytes,
  purpose,
  externalUserId,
  metadata,
}) {
  const maxUploadBytes = readPositiveInteger(env.MAX_UPLOAD_BYTES, DEFAULT_MAX_UPLOAD_BYTES)
  if (sizeBytes > maxUploadBytes) {
    throw new HttpError(413, 'size_too_large')
  }

  const r2 = resolveR2Config(env)
  const createdAt = new Date().toISOString()
  const uploadId = crypto.randomUUID()
  const objectKey = buildObjectKey({
    prefix: r2.prefix,
    uploadId,
    filename,
    contentType,
    createdAt,
  })
  const publicUrl = buildPublicUrl(r2.publicBaseUrl, objectKey)
  const expiresAt = new Date(Date.now() + r2.expiresInSeconds * 1000).toISOString()

  const record = await createUploadRecord(env, {
    uploadId,
    objectKey,
    publicUrl,
    purpose,
    filename,
    contentType,
    sizeBytes,
    metadata: {
      ...metadata,
      purpose,
      fileName: filename,
      contentType,
      sizeBytes,
      externalUserId: externalUserId || undefined,
    },
    externalUserId: externalUserId || null,
    expiresAt,
  })

  return {
    record,
    objectKey,
    publicUrl,
    expiresAt,
  }
}

function buildUploadResponse(upload, extra = {}) {
  const normalized = uploadRowToResponse(upload)
  return {
    ...normalized,
    ...extra,
    uploadId: normalized.uploadId,
    key: normalized.objectKey,
    objectKey: normalized.objectKey,
    photo: extra.photo || normalized.publicUrl,
    publicUrl: extra.publicUrl || normalized.publicUrl,
    publicURL: extra.publicURL || normalized.publicUrl,
    url: extra.url || normalized.publicUrl,
    photoUrl: extra.photoUrl || normalized.publicUrl,
  }
}

function readRequestClientIp(request) {
  const xForwardedFor = trimString(request.headers.get('x-forwarded-for'))
  const forwardedIp = xForwardedFor ? xForwardedFor.split(',')[0].trim() : ''
  return (
    trimString(request.headers.get('cf-connecting-ip')) ||
    forwardedIp ||
    trimString(request.headers.get('x-real-ip')) ||
    'unknown'
  )
}

function readRequestUserAgent(request) {
  return trimString(request.headers.get('user-agent'))
}

function readCheckInDeviceId(request) {
  const clientIp = readRequestClientIp(request)
  const userAgent = readRequestUserAgent(request)
  return (
    trimString(request.headers.get('x-checkin-device-id')) ||
    trimString(request.headers.get('x-device-id')) ||
    `${clientIp}|${userAgent}`
  )
}

async function enforceCheckInDeviceDailyLimit(env, request) {
  const deviceId = readCheckInDeviceId(request)
  const result = await bumpDeviceDailyLimit(env, {
    deviceId,
    limit: CHECKIN_DEVICE_DAILY_LIMIT,
  })

  if (!result.allowed) {
    throw new HttpError(429, '这台设备今天已达到 100 次提交上限，请明天再试。')
  }

  return result
}

async function handleGuestCreate(env, request) {
  const contentType = toLowerTrim(request.headers.get('content-type'))
  let name
  let role
  let photo = ''
  let uploadPayload = null

  if (contentType.startsWith('multipart/form-data')) {
    const formData = await request.formData().catch(() => {
      throw new HttpError(400, 'invalid_form_data')
    })

    name = trimString(formData.get('name') || formData.get('fullName') || formData.get('nickname'))
    role = trimString(formData.get('role') || formData.get('identity'))

    if (!name) {
      throw new HttpError(400, '请输入姓名或昵称')
    }

    if (!role) {
      throw new HttpError(400, '请选择身份')
    }

    const file = formData.get('file')
    if (file instanceof File) {
      const {
        filename,
        contentType: fileContentType,
        sizeBytes,
        purpose,
        externalUserId,
        metadata,
      } = readUploadInputFromForm(formData)

      const { record } = await prepareUploadRecord(env, {
        filename,
        contentType: fileContentType,
        sizeBytes,
        purpose,
        externalUserId,
        metadata,
      })

      try {
        await uploadObjectToR2(env, {
          objectKey: record.objectKey,
          contentType: fileContentType,
          body: file,
        })

        const verification = await verifyObjectExists(env, {
          objectKey: record.objectKey,
          contentType: fileContentType,
        })

        const completed = await completeUploadRecord(env, record.uploadId)
        photo = completed.publicUrl
        uploadPayload = buildUploadResponse(completed, {
          photo: completed.publicUrl,
          publicUrl: completed.publicUrl,
          publicURL: completed.publicUrl,
          url: completed.publicUrl,
          photoUrl: completed.publicUrl,
          r2SizeBytes: verification.sizeBytes,
          etag: verification.etag,
        })
      } catch (error) {
        try {
          await deleteObjectFromR2(env, {
            objectKey: record.objectKey,
            contentType: fileContentType,
          })
        } catch {
          // Best-effort cleanup only.
        }

        try {
          await deleteUploadRecord(env, record.uploadId)
        } catch {
          // Best-effort cleanup only.
        }

        throw error
      }
    }

    if (!photo) {
      photo = trimString(formData.get('photo') || formData.get('photoUrl') || formData.get('publicUrl') || formData.get('url'))
    }
  } else {
    const body = await readJsonBody(request)
    name = trimString(body.name || body.fullName || body.nickname)
    role = trimString(body.role || body.identity)
    photo = trimString(body.photo || body.photoUrl || body.publicUrl || body.url)
  }

  if (!name) {
    throw new HttpError(400, '请输入姓名或昵称')
  }

  if (!role) {
    throw new HttpError(400, '请选择身份')
  }

  if (!photo) {
    throw new HttpError(400, '请先上传头像')
  }

  await enforceCheckInDeviceDailyLimit(env, request)

  const guest = await createGuest(env, {
    name,
    role,
    photo,
  })

  return jsonResponse(
    {
      guest,
      guests: [guest],
      ...(uploadPayload ? { upload: uploadPayload } : {}),
    },
    { status: 201 },
  )
}

async function handleContentGet(env, section) {
  if (section === 'poster') {
    const poster = await getActiveContentItem(env, section)
    return jsonResponse(
      { poster },
      {
        headers: {
          'Cache-Control': cacheControlHeader({ maxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 }),
        },
      },
    )
  }

  if (section === 'program') {
    const program = await getActiveContentItem(env, section)
    return jsonResponse(
      { program },
      {
        headers: {
          'Cache-Control': cacheControlHeader({ maxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 }),
        },
      },
    )
  }

  if (section === 'works') {
    const works = await listContentItems(env, 'work')
    return jsonResponse(
      { works },
      {
        headers: {
          'Cache-Control': cacheControlHeader({ maxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 }),
        },
      },
    )
  }

  throw new HttpError(404, 'not_found')
}

async function handleBootstrap(env, url) {
  const guestLimit = readBoundedInteger(
    url.searchParams.get('guestLimit') || url.searchParams.get('limit'),
    DEFAULT_BOOTSTRAP_GUEST_LIMIT,
    MAX_GUEST_LIST_LIMIT,
  )
  const [poster, program, works, guests, guestCount] = await Promise.all([
    getActiveContentItem(env, 'poster'),
    getActiveContentItem(env, 'program'),
    listContentItems(env, 'work'),
    listGuests(env, { limit: guestLimit }),
    countGuests(env),
  ])

  return jsonResponse(
    {
      poster,
      program,
      works,
      guests,
      guestCount,
      totalGuests: guestCount,
    },
    {
      headers: {
        'Cache-Control': cacheControlHeader({ maxAgeSeconds: 30, staleWhileRevalidateSeconds: 300 }),
      },
    },
  )
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const { pathname } = url

    if (request.method === 'OPTIONS') {
      return optionsResponse()
    }

    try {
      if (pathname === '/' || pathname === '/api/health') {
        return textResponse('guest-api ok')
      }

      if (request.method === 'GET' && pathname === '/api/posters/active') {
        return await handleContentGet(env, 'poster')
      }

      if (request.method === 'GET' && pathname === '/api/program') {
        return await handleContentGet(env, 'program')
      }

      if (request.method === 'GET' && pathname === '/api/works') {
        return await handleContentGet(env, 'works')
      }

      if (request.method === 'GET' && pathname === '/api/bootstrap') {
        return await handleBootstrap(env, url)
      }

      if (request.method === 'GET' && pathname === '/api/guests') {
        const limit = readBoundedInteger(
          url.searchParams.get('limit'),
          MAX_GUEST_LIST_LIMIT,
          MAX_GUEST_LIST_LIMIT,
        )
        const [guests, guestCount] = await Promise.all([
          listGuests(env, { limit }),
          countGuests(env),
        ])
        return jsonResponse(
          { guests, guestCount, totalGuests: guestCount },
          {
            headers: {
              'Cache-Control': 'no-store',
            },
          },
        )
      }

      if (request.method === 'POST' && pathname === '/api/guests') {
        return await handleGuestCreate(env, request)
      }

      throw new HttpError(404, 'not_found')
    } catch (error) {
      return toErrorResponse(error)
    }
  },
}
