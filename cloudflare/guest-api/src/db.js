function nowIso() {
  return new Date().toISOString()
}

function getShanghaiDayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function toPositiveInteger(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function safeJsonParse(value, fallback = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(String(value || '')),
  )

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function guestRowToResponse(row) {
  if (!row) {
    return null
  }

  const createdAt = row.created_at || row.createdAt || nowIso()
  const updatedAt = row.updated_at || row.updatedAt || createdAt

  return {
    id: String(row.id || ''),
    name: String(row.name || ''),
    fullName: String(row.name || ''),
    role: String(row.role || ''),
    identity: String(row.role || ''),
    photo: String(row.photo || ''),
    timestamp: String(createdAt || updatedAt || nowIso()),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  }
}

export function uploadRowToResponse(row) {
  if (!row) {
    return null
  }

  const metadata = row.metadata && typeof row.metadata === 'object'
    ? row.metadata
    : safeJsonParse(row.metadata_json, {})
  const uploadId = row.upload_id || row.uploadId || ''
  const objectKey = row.object_key || row.objectKey || ''
  const publicUrl = row.public_url || row.publicUrl || ''
  const purpose = row.purpose || ''
  const filename = row.filename || ''
  const contentType = row.content_type || row.contentType || ''
  const sizeBytes = Number(row.size_bytes || row.sizeBytes || 0)
  const externalUserId = row.external_user_id || row.externalUserId || ''
  const status = row.status || ''
  const expiresAt = row.expires_at || row.expiresAt || ''
  const createdAt = row.created_at || row.createdAt || ''
  const updatedAt = row.updated_at || row.updatedAt || createdAt
  const uploadedAt = row.uploaded_at || row.uploadedAt || null
  const deletedAt = row.deleted_at || row.deletedAt || null

  return {
    uploadId: String(uploadId),
    key: String(objectKey),
    objectKey: String(objectKey),
    uploadURL: '',
    uploadUrl: '',
    publicUrl: String(publicUrl),
    publicURL: String(publicUrl),
    url: String(publicUrl),
    photo: String(publicUrl),
    photoUrl: String(publicUrl),
    purpose: String(purpose),
    filename: String(filename),
    contentType: String(contentType),
    sizeBytes,
    metadata,
    externalUserId: externalUserId ? String(externalUserId) : '',
    status: String(status),
    expiresAt: String(expiresAt),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
    uploadedAt: uploadedAt ? String(uploadedAt) : null,
    deletedAt: deletedAt ? String(deletedAt) : null,
  }
}

export function contentRowToResponse(row) {
  if (!row) {
    return null
  }

  const payload = row.payload && typeof row.payload === 'object'
    ? row.payload
    : safeJsonParse(row.payload_json || row.payloadJson, {})
  const createdAt = row.created_at || row.createdAt || ''
  const updatedAt = row.updated_at || row.updatedAt || createdAt

  return {
    id: String(row.id || row.section || ''),
    section: String(row.section || ''),
    slug: String(row.slug || ''),
    isActive: Boolean(row.is_active ?? row.isActive),
    sortOrder: Number(row.sort_order || row.sortOrder || 0),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
    ...payload,
  }
}

export async function listGuests(env, { limit = 100 } = {}) {
  const normalizedLimit = Math.min(Math.max(toPositiveInteger(limit, 100), 1), 200)
  const result = await env.DB.prepare(
    `SELECT id, name, role, photo, request_id, created_at, updated_at
     FROM guests
     ORDER BY created_at DESC
     LIMIT ?1`,
  )
    .bind(normalizedLimit)
    .all()

  return (result.results || []).reverse().map((row) => guestRowToResponse(row))
}

export async function countGuests(env) {
  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM guests').first()
  return toPositiveInteger(row?.count, 0)
}

export async function createGuest(env, input) {
  const name = String(input?.name || '').trim()
  const role = String(input?.role || input?.identity || '').trim()
  const photo = String(input?.photo || '').trim()

  if (!name) {
    throw new Error('请输入姓名或昵称')
  }

  if (!role) {
    throw new Error('请选择身份')
  }

  if (!photo) {
    throw new Error('请上传头像')
  }

  const timestamp = nowIso()
  const id = crypto.randomUUID()
  const requestId = crypto.randomUUID()

  await env.DB.prepare(
    'INSERT INTO guests (id, name, role, photo, request_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  )
    .bind(id, name, role, photo, requestId, timestamp, timestamp)
    .run()

  return guestRowToResponse({
    id,
    name,
    role,
    photo,
    request_id: requestId,
    created_at: timestamp,
    updated_at: timestamp,
  })
}

export async function listContentItems(env, section) {
  const result = await env.DB.prepare(
    'SELECT id, section, slug, payload_json, is_active, sort_order, created_at, updated_at FROM content_items WHERE section = ?1 AND is_active = 1 ORDER BY sort_order ASC, updated_at ASC',
  )
    .bind(section)
    .all()

  return (result.results || []).map((row) => contentRowToResponse(row))
}

export async function getActiveContentItem(env, section) {
  const row = await env.DB.prepare(
    'SELECT id, section, slug, payload_json, is_active, sort_order, created_at, updated_at FROM content_items WHERE section = ?1 AND is_active = 1 ORDER BY sort_order ASC, updated_at ASC LIMIT 1',
  )
    .bind(section)
    .first()

  return contentRowToResponse(row)
}

export async function createUploadRecord(env, input) {
  const timestamp = nowIso()
  const metadata = input?.metadata && typeof input.metadata === 'object' ? input.metadata : {}

  await env.DB.prepare(
    `INSERT INTO uploads (
      upload_id,
      object_key,
      public_url,
      purpose,
      filename,
      content_type,
      size_bytes,
      metadata_json,
      external_user_id,
      status,
      expires_at,
      created_at,
      updated_at,
      uploaded_at,
      deleted_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10, ?11, ?11, NULL, NULL)`,
  )
    .bind(
      input.uploadId,
      input.objectKey,
      input.publicUrl,
      input.purpose,
      input.filename,
      input.contentType,
      input.sizeBytes,
      JSON.stringify(metadata),
      input.externalUserId || null,
      input.expiresAt,
      timestamp,
    )
    .run()

  return getUploadById(env, input.uploadId)
}

export async function getUploadById(env, uploadId) {
  const row = await env.DB.prepare(
    'SELECT upload_id, object_key, public_url, purpose, filename, content_type, size_bytes, metadata_json, external_user_id, status, expires_at, created_at, updated_at, uploaded_at, deleted_at FROM uploads WHERE upload_id = ?1 LIMIT 1',
  )
    .bind(uploadId)
    .first()

  return uploadRowToResponse(row)
}

export async function updateUploadStatus(env, uploadId, patch) {
  const current = await getUploadById(env, uploadId)
  if (!current) {
    return null
  }

  const next = {
    status: patch.status || current.status,
    updatedAt: patch.updatedAt || nowIso(),
    uploadedAt: patch.uploadedAt ?? current.uploadedAt,
    deletedAt: patch.deletedAt ?? current.deletedAt,
  }

  await env.DB.prepare(
    `UPDATE uploads
     SET status = ?1,
         updated_at = ?2,
         uploaded_at = ?3,
         deleted_at = ?4
     WHERE upload_id = ?5`,
  )
    .bind(
      next.status,
      next.updatedAt,
      next.uploadedAt,
      next.deletedAt,
      uploadId,
    )
    .run()

  return getUploadById(env, uploadId)
}

export async function completeUploadRecord(env, uploadId) {
  return updateUploadStatus(env, uploadId, {
    status: 'completed',
    uploadedAt: nowIso(),
  })
}

export async function deleteUploadRecord(env, uploadId) {
  return updateUploadStatus(env, uploadId, {
    status: 'deleted',
    deletedAt: nowIso(),
  })
}

export async function bumpDeviceDailyLimit(env, { deviceId, limit }) {
  const timestamp = nowIso()
  const dayKey = getShanghaiDayKey()
  const deviceHash = await sha256Hex(deviceId)

  await env.DB.prepare(
    `INSERT INTO checkin_device_daily_limits (
      device_hash,
      day_key,
      count,
      created_at,
      updated_at
    ) VALUES (?1, ?2, 1, ?3, ?3)
    ON CONFLICT(device_hash, day_key) DO UPDATE SET
      count = checkin_device_daily_limits.count + 1,
      updated_at = excluded.updated_at`,
  )
    .bind(deviceHash, dayKey, timestamp)
    .run()

  const row = await env.DB.prepare(
    'SELECT device_hash, day_key, count, created_at, updated_at FROM checkin_device_daily_limits WHERE device_hash = ?1 AND day_key = ?2 LIMIT 1',
  )
    .bind(deviceHash, dayKey)
    .first()

  const count = toPositiveInteger(row?.count, 0)
  return {
    deviceHash,
    dayKey: String(row?.day_key || dayKey),
    count,
    limit,
    allowed: count <= limit,
  }
}
