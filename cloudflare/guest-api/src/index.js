import {
  completeUploadRecord,
  createGuest,
  createUploadRecord,
  deleteUploadRecord,
  getActiveContentItem,
  getUploadById,
  listContentItems,
  listGuests,
  uploadRowToResponse,
} from './db.js'
import {
  buildObjectKey,
  buildPublicUrl,
  createSignedUploadUrl,
  deleteObjectFromR2,
  resolveR2Config,
  verifyObjectExists,
  uploadObjectToR2,
} from './r2.js'
import {
  HttpError,
  jsonResponse,
  optionsResponse,
  readJsonBody,
  textResponse,
  toErrorResponse,
  toLowerTrim,
  trimString,
} from './http.js'

function normalizePrefix(prefix) {
  return String(prefix || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

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
  const maxUploadBytes = readPositiveInteger(env.MAX_UPLOAD_BYTES, 10 * 1024 * 1024)
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

function buildBaseUploadPayload(record, uploadUrl) {
  return {
    uploadId: record.uploadId,
    key: record.objectKey,
    objectKey: record.objectKey,
    uploadURL: uploadUrl,
    uploadUrl,
    publicUrl: record.publicUrl,
    publicURL: record.publicUrl,
    url: record.publicUrl,
    purpose: record.purpose,
    filename: record.filename,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    metadata: record.metadata,
    externalUserId: record.externalUserId || '',
    expiresAt: record.expiresAt,
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

async function handleUploadsInit(env, request) {
  const body = await readJsonBody(request)
  const filename = trimString(body.fileName || body.filename || body.name)
  const contentType = ensureImageContentType(body.contentType || body.mimeType)
  const sizeBytes = readPositiveInteger(body.sizeBytes || body.size || body.fileSize, 0)
  const purpose = trimString(body.purpose) || 'guest-avatar'
  const externalUserId = trimString(body.externalUserId || body.userId)
  const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}

  if (!filename) {
    throw new HttpError(400, 'invalid_filename')
  }

  if (!sizeBytes) {
    throw new HttpError(400, 'invalid_size')
  }

  const { record, publicUrl, expiresAt } = await prepareUploadRecord(env, {
    filename,
    contentType,
    sizeBytes,
    purpose,
    externalUserId,
    metadata,
  })

  const uploadUrl = await createSignedUploadUrl(env, {
    objectKey: record.objectKey,
    contentType,
  })

  const payload = buildBaseUploadPayload(
    {
      ...record,
      publicUrl,
      expiresAt,
    },
    uploadUrl,
  )

  return jsonResponse({ upload: payload, ...payload })
}

async function handleUploadsProxy(env, request) {
  const formData = await request.formData().catch(() => {
    throw new HttpError(400, 'invalid_form_data')
  })

  const {
    file,
    filename,
    contentType,
    sizeBytes,
    purpose,
    externalUserId,
    metadata,
  } = readUploadInputFromForm(formData)

  const { record } = await prepareUploadRecord(env, {
    filename,
    contentType,
    sizeBytes,
    purpose,
    externalUserId,
    metadata,
  })

  try {
    await uploadObjectToR2(env, {
      objectKey: record.objectKey,
      contentType,
      body: file,
    })

    const verification = await verifyObjectExists(env, {
      objectKey: record.objectKey,
      contentType,
    })

    const completed = await completeUploadRecord(env, record.uploadId)
    const payload = buildUploadResponse(completed, {
      photo: completed.publicUrl,
      publicUrl: completed.publicUrl,
      publicURL: completed.publicUrl,
      url: completed.publicUrl,
      photoUrl: completed.publicUrl,
      r2SizeBytes: verification.sizeBytes,
      etag: verification.etag,
    })

    return jsonResponse({ upload: payload, ...payload })
  } catch (error) {
    try {
      await deleteObjectFromR2(env, {
        objectKey: record.objectKey,
        contentType,
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

async function handleUploadsComplete(env, request) {
  const body = await readJsonBody(request)
  const uploadId = trimString(body.uploadId || body.key || body.imageId || body.id)

  if (!uploadId) {
    throw new HttpError(400, 'invalid_upload_id')
  }

  const record = await getUploadById(env, uploadId)
  if (!record) {
    throw new HttpError(404, 'upload_not_found')
  }

  if (record.status === 'deleted') {
    throw new HttpError(409, 'deleted')
  }

  const verification = await verifyObjectExists(env, {
    objectKey: record.objectKey,
    contentType: record.contentType,
  })

  const completed = await completeUploadRecord(env, uploadId)
  const payload = buildUploadResponse(completed, {
    photo: completed.publicUrl,
    publicUrl: completed.publicUrl,
    publicURL: completed.publicUrl,
    url: completed.publicUrl,
    photoUrl: completed.publicUrl,
    r2SizeBytes: verification.sizeBytes,
    etag: verification.etag,
  })

  return jsonResponse({ upload: payload, ...payload })
}

async function handleUploadsDelete(env, uploadId) {
  const record = await getUploadById(env, uploadId)
  if (!record) {
    throw new HttpError(404, 'upload_not_found')
  }

  const prefix = normalizePrefix(env.R2_KEY_PREFIX || 'prod/guests')
  if (prefix && !record.objectKey.startsWith(`${prefix}/`)) {
    throw new HttpError(403, 'forbidden_key')
  }

  await deleteObjectFromR2(env, {
    objectKey: record.objectKey,
    contentType: record.contentType,
  })

  const deleted = await deleteUploadRecord(env, uploadId)
  const payload = buildUploadResponse(deleted, {
    photo: deleted.publicUrl,
    publicUrl: deleted.publicUrl,
    publicURL: deleted.publicUrl,
    url: deleted.publicUrl,
    photoUrl: deleted.publicUrl,
  })

  return jsonResponse({ upload: payload, ...payload })
}

async function handleContentGet(env, section) {
  if (section === 'poster') {
    const poster = await getActiveContentItem(env, section)
    return jsonResponse({ poster })
  }

  if (section === 'program') {
    const program = await getActiveContentItem(env, section)
    return jsonResponse({ program })
  }

  if (section === 'works') {
    const works = await listContentItems(env, 'work')
    return jsonResponse({ works })
  }

  throw new HttpError(404, 'not_found')
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

      if (request.method === 'GET' && pathname === '/api/guests') {
        return jsonResponse({ guests: await listGuests(env) })
      }

      if (request.method === 'POST' && pathname === '/api/guests') {
        const body = await readJsonBody(request)
        const guest = await createGuest(env, body)
        return jsonResponse({ guest, guests: [guest] }, { status: 201 })
      }

      if (request.method === 'POST' && pathname === '/api/uploads/init') {
        return await handleUploadsInit(env, request)
      }

      if (request.method === 'POST' && pathname === '/api/uploads/complete') {
        return await handleUploadsComplete(env, request)
      }

      if (request.method === 'POST' && pathname === '/api/uploads/proxy') {
        return await handleUploadsProxy(env, request)
      }

      const uploadMatch = pathname.match(/^\/api\/uploads\/([^/]+)$/)
      if (uploadMatch && request.method === 'GET') {
        const upload = await getUploadById(env, uploadMatch[1])
        if (!upload) {
          throw new HttpError(404, 'upload_not_found')
        }
        return jsonResponse({ upload, ...upload })
      }

      if (uploadMatch && request.method === 'DELETE') {
        return await handleUploadsDelete(env, uploadMatch[1])
      }

      throw new HttpError(404, 'not_found')
    } catch (error) {
      return toErrorResponse(error)
    }
  },
}
