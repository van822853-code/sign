const DRAFT_STORAGE_KEY = 'show-plan-event-check-in-draft-v1'
const DRAFT_DB_NAME = 'show-plan-event-check-in-draft-db'
const DRAFT_STORE_NAME = 'draft-assets'
const DRAFT_AVATAR_KEY = 'avatar'

function canUseBrowserStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function openDraftDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DRAFT_DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        db.createObjectStore(DRAFT_STORE_NAME)
      }
    }

    request.onerror = () => {
      reject(request.error || new Error('无法打开本地草稿存储'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

function readDraftStore() {
  return openDraftDatabase().then((db) => {
    if (!db) {
      return null
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DRAFT_STORE_NAME, 'readonly')
      const store = transaction.objectStore(DRAFT_STORE_NAME)
      const request = store.get(DRAFT_AVATAR_KEY)

      request.onerror = () => {
        reject(request.error || new Error('无法读取本地草稿头像'))
      }

      request.onsuccess = () => {
        resolve(request.result ?? null)
      }

      transaction.oncomplete = () => {
        db.close()
      }

      transaction.onerror = () => {
        db.close()
        reject(transaction.error || new Error('无法读取本地草稿头像'))
      }

      transaction.onabort = () => {
        db.close()
        reject(transaction.error || new Error('无法读取本地草稿头像'))
      }
    })
  })
}

function writeDraftStore(value) {
  return openDraftDatabase().then((db) => {
    if (!db) {
      return null
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DRAFT_STORE_NAME, 'readwrite')
      const store = transaction.objectStore(DRAFT_STORE_NAME)
      const request = value ? store.put(value, DRAFT_AVATAR_KEY) : store.delete(DRAFT_AVATAR_KEY)

      request.onerror = () => {
        reject(request.error || new Error('无法写入本地草稿头像'))
      }

      transaction.oncomplete = () => {
        db.close()
        resolve(request.result ?? null)
      }

      transaction.onerror = () => {
        db.close()
        reject(transaction.error || new Error('无法写入本地草稿头像'))
      }

      transaction.onabort = () => {
        db.close()
        reject(transaction.error || new Error('无法写入本地草稿头像'))
      }
    })
  })
}

function createAvatarFile(record, avatarBlob) {
  if (!avatarBlob) {
    return null
  }

  if (avatarBlob instanceof File) {
    return avatarBlob
  }

  const name = record?.avatar?.name || 'guest-avatar.jpg'
  const type = record?.avatar?.type || avatarBlob.type || 'application/octet-stream'
  const lastModified = record?.avatar?.lastModified || Date.now()

  return new File([avatarBlob], name, { type, lastModified })
}

function normalizeDraft(rawDraft) {
  if (!rawDraft || typeof rawDraft !== 'object') {
    return null
  }

  return {
    version: rawDraft.version || 1,
    updatedAt: rawDraft.updatedAt || new Date().toISOString(),
    formStep: Number.isInteger(rawDraft.formStep) ? rawDraft.formStep : 0,
    formData: {
      fullName: rawDraft.formData?.fullName || '',
      identity: rawDraft.formData?.identity || '',
    },
    avatar: rawDraft.avatar || null,
  }
}

function readStoredDraftRecord() {
  if (!canUseBrowserStorage()) {
    return null
  }

  try {
    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    return normalizeDraft(rawDraft ? JSON.parse(rawDraft) : null)
  } catch {
    return null
  }
}

function writeStoredDraftRecord(record) {
  if (!canUseBrowserStorage()) {
    return
  }

  window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(record))
}

export async function loadCheckInDraft() {
  if (!canUseBrowserStorage()) {
    return null
  }

  const record = readStoredDraftRecord()

  if (!record) {
    return null
  }

  let avatarFile = null
  try {
    const avatarBlob = await readDraftStore()
    avatarFile = createAvatarFile(record, avatarBlob)
  } catch (error) {
    console.warn('Unable to restore cached avatar', error)
  }

  return {
    formStep: record.formStep,
    formData: record.formData,
    avatarFile,
    avatar: record.avatar,
    updatedAt: record.updatedAt,
  }
}

function getDraftRecord(formStep, formData, avatarFile) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    formStep: Number.isInteger(formStep) ? formStep : 0,
    formData: {
      fullName: formData?.fullName || '',
      identity: formData?.identity || '',
    },
    avatar: avatarFile
      ? {
          name: avatarFile.name || 'guest-avatar.jpg',
          type: avatarFile.type || 'application/octet-stream',
          size: avatarFile.size || 0,
          lastModified: avatarFile.lastModified || Date.now(),
        }
      : null,
  }
}

export async function saveCheckInDraftMeta({ formStep, formData }) {
  if (!canUseBrowserStorage()) {
    return
  }

  const existingRecord = readStoredDraftRecord()
  const record = {
    ...getDraftRecord(formStep, formData, null),
    avatar: existingRecord?.avatar || null,
  }

  try {
    writeStoredDraftRecord(record)
  } catch (error) {
    console.warn('Unable to persist check-in draft metadata', error)
  }
}

export async function saveCheckInDraftAvatar(avatarFile) {
  if (!canUseBrowserStorage()) {
    return
  }

  try {
    await writeDraftStore(avatarFile || null)
    const existingRecord = readStoredDraftRecord()
    if (existingRecord) {
      writeStoredDraftRecord({
        ...existingRecord,
        updatedAt: new Date().toISOString(),
        avatar: avatarFile
          ? {
              name: avatarFile.name || 'guest-avatar.jpg',
              type: avatarFile.type || 'application/octet-stream',
              size: avatarFile.size || 0,
              lastModified: avatarFile.lastModified || Date.now(),
            }
          : null,
      })
    } else if (avatarFile) {
      writeStoredDraftRecord(
        getDraftRecord(0, { fullName: '', identity: '' }, avatarFile),
      )
    }
  } catch (error) {
    console.warn('Unable to persist check-in draft avatar', error)
  }
}

export async function clearCheckInDraft() {
  if (!canUseBrowserStorage()) {
    return
  }

  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY)
  } catch (error) {
    console.warn('Unable to clear check-in draft metadata', error)
  }

  try {
    await writeDraftStore(null)
  } catch (error) {
    console.warn('Unable to clear check-in draft avatar', error)
  }
}
