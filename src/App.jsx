import { useCallback, useEffect, useRef, useState } from 'react'
import './index.css'
import {
  createGuest,
  fetchActivePoster,
  fetchGuests,
  fetchProgram,
  fetchWorks,
  uploadGuestAvatar,
} from './lib/api'

const identityOptions = ['老师', '本课程同学', '其他学生', '其他观众']
const storageKey = 'show-plan-event-guests-cache'
const stepLabels = ['NAME', 'SELFIE', 'ROLE', 'JOIN']

function getIdentityTone(identity) {
  const toneMap = {
    老师: 'teacher',
    本课程同学: 'course-student',
    其他学生: 'outside-student',
    其他观众: 'other-visitor',
  }

  return toneMap[identity] || 'other-visitor'
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '[]').map(normalizeGuest)
  } catch {
    return []
  }
}

function normalizeGuest(guest) {
  return {
    ...guest,
    fullName: guest.fullName || guest.name || '',
    name: guest.name || guest.fullName || 'Unnamed Guest',
    identity: guest.identity || guest.role || '',
    role: guest.role || guest.identity || '',
    photo: guest.photo || guest.publicUrl || guest.url || guest.imageUrl || '',
    timestamp:
      guest.createdAt ||
      guest.updatedAt ||
      guest.timestamp ||
      guest.registeredAt ||
      new Date().toISOString(),
  }
}

function getPosterImage(poster) {
  if (!poster) {
    return ''
  }

  return poster.imageUrl || poster.posterUrl || poster.url || poster.src || ''
}

function getPosterTitle(poster) {
  if (!poster) {
    return ''
  }

  return poster.title || poster.name || poster.alt || '活动海报'
}

function getWorkTitle(work) {
  return work.title || work.name || work.prompt || work.description || 'Untitled Work'
}

function isExpiredInvite() {
  const params = new URLSearchParams(window.location.search)
  const expires = params.get('expires')

  if (!expires) {
    return false
  }

  const expiresAt = Date.parse(expires)
  return Number.isFinite(expiresAt) && Date.now() > expiresAt
}

function AmbientStage() {
  const traceLines = [
    'M-30 590 L130 510 L250 310 L505 250 L830 350 L980 310',
    'M40 720 L190 620 L285 705 L382 585 L510 425 L790 520 L930 430',
    'M120 85 L260 170 L185 300 L330 330 L475 380 L610 535 L735 566 L960 365',
    'M-20 250 L110 205 L180 160 L255 220 L340 295 L455 110 L555 180 L920 92',
    'M260 850 L340 710 L505 768 L588 632 L720 415 L850 630 L1000 515',
    'M25 430 L160 515 L285 475 L390 610 L520 565 L670 730 L830 690 L985 780',
    'M690 -40 L625 125 L760 260 L690 390 L610 540 L685 660 L640 860',
  ]

  return (
    <div className="ambient-stage" aria-hidden="true">
      <div className="deep-field" />
      <div className="signal-dust" />
      <svg className="constellation-map" viewBox="0 0 1000 860" preserveAspectRatio="none">
        {traceLines.map((line, index) => (
          <path className="trace-line" d={line} key={line} style={{ '--i': index }} />
        ))}
        {Array.from({ length: 34 }).map((_, index) => (
          <circle
            className="trace-node"
            cx={(index * 89 + 42) % 1000}
            cy={(index * 137 + 64) % 860}
            key={index}
            r={(index % 4) + 1.2}
            style={{ '--delay': `${(index % 8) * 0.31}s` }}
          />
        ))}
      </svg>
      <div className="wave wave-a" />
      <div className="wave wave-b" />
      <div className="grid-noise" />
      {Array.from({ length: 86 }).map((_, index) => (
        <span
          className="particle"
          key={index}
          style={{
            '--x': `${(index * 47 + 11) % 100}%`,
            '--y': `${(index * 61 + 7) % 100}%`,
            '--delay': `${(index % 13) * 0.28}s`,
            '--size': `${2 + (index % 4)}px`,
          }}
        />
      ))}
      {Array.from({ length: 26 }).map((_, index) => (
        <span
          className="shard"
          key={index}
          style={{
            '--x': `${(index * 73 + 5) % 100}%`,
            '--y': `${(index * 41 + 13) % 100}%`,
            '--r': `${(index * 29) % 180}deg`,
            '--s': `${0.72 + (index % 5) * 0.13}`,
            '--delay': `${(index % 7) * 0.43}s`,
          }}
        />
      ))}
    </div>
  )
}

function SignalPills() {
  return (
    <div className="signal-pills" aria-hidden="true">
      <span>Program Live</span>
      <span>Guests Joining</span>
      <span>Poster / Works / Sign-in</span>
    </div>
  )
}

function Avatar({ entry, className = '' }) {
  const [failedPhoto, setFailedPhoto] = useState('')
  const initial = (entry.name || entry.fullName || '?').trim().slice(0, 1).toUpperCase()
  const toneClass = `avatar-${getIdentityTone(entry.identity)}`
  const imageFailed = failedPhoto === entry.photo

  return entry.photo && !imageFailed ? (
    <img
      className={`avatar-image ${toneClass} ${className}`}
      onError={() => setFailedPhoto(entry.photo)}
      src={entry.photo}
      alt={entry.name || entry.fullName || '头像'}
    />
  ) : (
    <span className={`avatar-image avatar-fallback ${toneClass} ${className}`}>
      {initial}
    </span>
  )
}

function FloatingMembers({ entries }) {
  const visibleEntries = entries.slice(-28)

  if (visibleEntries.length === 0) {
    return (
      <div className="empty-ensemble">
        <span>NO GUESTS YET</span>
        <p>等待第一位来宾登记。</p>
      </div>
    )
  }

  return (
    <div className="members-field" aria-label="已登记来宾">
      {visibleEntries.map((entry, index) => (
        <div
          className="floating-member"
          key={`${entry.timestamp}-${index}`}
          style={{
            '--x': `${8 + ((index * 29) % 82)}%`,
            '--y': `${12 + ((index * 43) % 70)}%`,
            '--delay': `${(index % 9) * -0.8}s`,
            '--scale': `${0.88 + (index % 5) * 0.05}`,
          }}
        >
          <Avatar entry={entry} />
          <span>{entry.name}</span>
        </div>
      ))}
    </div>
  )
}

function EventOverview({ poster, program, works }) {
  const posterImage = getPosterImage(poster)
  const visibleWorks = works.slice(0, 4)

  if (!posterImage && !program?.text && visibleWorks.length === 0) {
    return null
  }

  return (
    <section className="event-overview" aria-label="活动信息">
      {posterImage && (
        <article className="info-panel poster-panel">
          <span>ACTIVE POSTER</span>
          <img alt={getPosterTitle(poster)} src={posterImage} />
        </article>
      )}

      {program?.text && (
        <article className="info-panel">
          <span>PROGRAM</span>
          <p>{program.text}</p>
        </article>
      )}

      {visibleWorks.length > 0 && (
        <article className="info-panel">
          <span>WORKS</span>
          <ul className="info-list">
            {visibleWorks.map((work, index) => (
              <li key={work.id || work.slug || `${getWorkTitle(work)}-${index}`}>
                {getWorkTitle(work)}
              </li>
            ))}
          </ul>
        </article>
      )}
    </section>
  )
}

function EntrancePage({ entries, onEnter, poster, program, works }) {
  return (
    <main className="screen entrance-screen members-screen">
      <AmbientStage />
      <section className="members-home page-fade">
        <div className="members-heading">
          <SignalPills />
          <p className="eyebrow">Guest Check-in</p>
          <h1>正在登记的来宾</h1>
          <p>头像与名字会在现场中漂浮。完成登记后，你也会出现在这里。</p>
        </div>
        <EventOverview poster={poster} program={program} works={works} />
        <FloatingMembers entries={entries} />
        <div className="members-action">
          <button className="primary-action" type="button" onClick={onEnter}>
            开始登记
          </button>
        </div>
      </section>
    </main>
  )
}

function ExpiredPage() {
  return (
    <main className="screen expired-screen">
      <AmbientStage />
      <section className="success-shell page-fade">
        <p className="eyebrow">ENTRY CLOSED</p>
        <h1>
          This guest entrance has expired.
          <span>本次来宾入口已失效。</span>
        </h1>
        <p className="look-up">请向现场工作人员获取新的签到二维码。</p>
      </section>
    </main>
  )
}

async function getCameraStream() {
  const baseVideo = {
    width: { ideal: 960 },
    height: { ideal: 960 },
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...baseVideo,
        facingMode: { ideal: 'environment' },
      },
    })
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: baseVideo,
    })
  }
}

function PhotoCameraCapture({
  previewUrl,
  onCapture,
  onRetake,
  onConfirm,
  onChooseFile,
}) {
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraState, setCameraState] = useState('idle')
  const [message, setMessage] = useState('')

  function stopCameraStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error')
      setMessage('当前浏览器不支持实时摄像头。请使用手机自带浏览器重新打开页面。')
      return
    }

    if (!window.isSecureContext) {
      setCameraState('error')
      setMessage('摄像头需要 HTTPS 或 localhost 安全环境。请在受信任的浏览器中重新打开页面。')
      return
    }

    try {
      setCameraState('starting')
      stopCameraStream()
      const stream = await getCameraStream()

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setMessage('后置摄像头已打开。点击开始拍摄后可生成头像预览。')
      setCameraState('ready')
    } catch {
      setCameraState('error')
      setMessage('无法启动摄像头。请确认浏览器已允许摄像头权限，然后重新打开摄像头。')
    }
  }, [])

  useEffect(() => {
    if (previewUrl || cameraState !== 'idle') {
      return
    }

    const timer = window.setTimeout(() => {
      startCamera()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [cameraState, previewUrl, startCamera])

  useEffect(() => {
    if (cameraState !== 'ready' || previewUrl || !videoRef.current || !streamRef.current) {
      return
    }

    videoRef.current.srcObject = streamRef.current
    videoRef.current.play().catch(() => {})
  }, [cameraState, previewUrl])

  useEffect(() => {
    return () => {
      stopCameraStream()
    }
  }, [])

  async function captureFromVideo() {
    const video = videoRef.current
    if (!video?.videoWidth) {
      return
    }

    const canvas = document.createElement('canvas')
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')
    if (!context) {
      setMessage('当前浏览器无法处理拍照结果。请重试。')
      return
    }
    context.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      512,
      512,
    )

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    )
    if (!blob) {
      setMessage('当前浏览器无法生成头像文件，请重试。')
      return
    }

    const file = new File([blob], `guest-avatar-${Date.now()}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
    stopCameraStream()
    onCapture(file)
    setCameraState('captured')
    setMessage('已完成拍摄。可以重拍，或确认提交进入下一步。')
  }

  function chooseFile() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    stopCameraStream()
    onChooseFile(file)
    setCameraState('captured')
    setMessage('已选择头像。可以重拍，或确认提交进入下一步。')
  }

  function retakePhoto() {
    onRetake()
    setCameraState('idle')
    setMessage('已切回摄像头，请重新拍摄。')
  }

  function confirmPhoto() {
    if (!previewUrl) {
      return
    }

    onConfirm()
  }

  return (
    <div className="camera-capture">
      <input
        accept="image/*"
        aria-hidden="true"
        className="sr-only"
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
        onChange={handleFileChange}
      />
      <div className="camera-preview">
        {previewUrl ? (
          <img src={previewUrl} alt="头像预览" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted />
            {cameraState !== 'ready' && <span>CAMERA INPUT</span>}
          </>
        )}
      </div>

      <p className="camera-note">
        系统会优先调用后置摄像头。拍摄完成后可重拍，或确认提交继续后续登记。
      </p>
      {message && <p className="camera-message">{message}</p>}

      <div className="camera-actions">
        {!previewUrl ? (
          <>
            <button
              className="ghost-action"
              type="button"
              onClick={cameraState === 'ready' ? captureFromVideo : startCamera}
            >
              开始拍摄
            </button>
            <button className="primary-action" type="button" onClick={chooseFile}>
              选择头像
            </button>
          </>
        ) : (
          <>
            <button className="ghost-action" type="button" onClick={retakePhoto}>
              重拍
            </button>
            <button className="primary-action" type="button" onClick={confirmPhoto}>
              确认提交
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CheckInForm({ onSubmit, submitting, submitError }) {
  const [formStep, setFormStep] = useState(0)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('')
  const avatarPreviewUrlRef = useRef('')
  const [formData, setFormData] = useState({
    fullName: '',
    identity: '',
  })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    return () => {
      if (avatarPreviewUrlRef.current) {
        URL.revokeObjectURL(avatarPreviewUrlRef.current)
      }
    }
  }, [])

  function updateField(field, value) {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  function commitAvatarFile(file) {
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current)
    }

    const nextPreviewUrl = file ? URL.createObjectURL(file) : ''
    avatarPreviewUrlRef.current = nextPreviewUrl
    setAvatarFile(file || null)
    setAvatarPreviewUrl(nextPreviewUrl)
    setErrors((current) => ({
      ...current,
      avatarFile: '',
    }))
  }

  function clearAvatarFile() {
    commitAvatarFile(null)
  }

  function validateStep(step = formStep) {
    const nextErrors = {}

    if (step === 0 && !formData.fullName.trim()) {
      nextErrors.fullName = '请输入你的姓名或昵称'
    }

    if (step === 1) {
      if (!avatarFile) {
        nextErrors.avatarFile = '请先拍摄头像或选择头像'
      }
    }

    if (step === 2 && !formData.identity) {
      nextErrors.identity = '请选择身份'
    }

    setErrors(nextErrors)
    return !Object.values(nextErrors).some(Boolean)
  }

  function goNext() {
    if (!validateStep()) {
      return
    }

    setFormStep((current) => Math.min(current + 1, stepLabels.length - 1))
  }

  function goBack() {
    setErrors({})
    setFormStep((current) => Math.max(current - 1, 0))
  }

  function selectAndAdvance(field, value) {
    updateField(field, value)
    window.setTimeout(() => {
      setFormStep((current) => Math.min(current + 1, stepLabels.length - 1))
    }, 220)
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (!validateStep(0)) {
      setFormStep(0)
      return
    }

    if (!validateStep(1)) {
      setFormStep(1)
      return
    }

    if (!validateStep(2)) {
      setFormStep(2)
      return
    }

    onSubmit({
      name: formData.fullName.trim(),
      role: formData.identity,
      photo: avatarFile,
    })
  }

  return (
    <main className="screen form-screen">
      <AmbientStage />
      <section className="form-shell page-fade">
        <SignalPills />
        <div className="section-heading">
          <p className="eyebrow">CHECK-IN SIGNAL</p>
          <h1>Guest Registration / 来宾登记</h1>
          <p>请填写姓名、身份，并通过后置摄像头拍摄头像，登记后头像会出现在现场来宾列表中。</p>
        </div>

        <div className="step-progress" aria-label="check-in progress">
          {stepLabels.map((label, index) => (
            <span
              className={index <= formStep ? 'progress-dot active' : 'progress-dot'}
              key={label}
            >
              {label}
            </span>
          ))}
        </div>

        <form className="checkin-form step-form" onSubmit={handleSubmit} noValidate>
          {formStep === 0 && (
            <section className="form-step page-fade" aria-label="姓名">
              <label className="field-block focus-field">
                <span>姓名 / 昵称</span>
                <input
                  autoComplete="name"
                  autoFocus
                  onChange={(event) => updateField('fullName', event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      goNext()
                    }
                  }}
                  placeholder="请输入你的姓名或昵称"
                  value={formData.fullName}
                />
                {errors.fullName && <em>{errors.fullName}</em>}
              </label>
              <button className="primary-action submit-action" type="button" onClick={goNext}>
                Continue / 继续
              </button>
            </section>
          )}

          {formStep === 1 && (
            <section className="form-step page-fade" aria-label="头像拍摄">
              <div className="field-block">
                <span>头像拍摄</span>
                <PhotoCameraCapture
                  onCapture={commitAvatarFile}
                  onConfirm={() => setFormStep(2)}
                  onChooseFile={commitAvatarFile}
                  onRetake={clearAvatarFile}
                  previewUrl={avatarPreviewUrl}
                />
                {errors.avatarFile && <em>{errors.avatarFile}</em>}
              </div>
              <div className="step-actions">
                <button className="ghost-action" type="button" onClick={goBack}>
                  Back
                </button>
              </div>
            </section>
          )}

          {formStep === 2 && (
            <section className="form-step page-fade" aria-label="身份">
              <fieldset className="field-block">
                <legend>身份</legend>
                <div className="option-grid identity-grid">
                  {identityOptions.map((option) => (
                    <label
                      className={formData.identity === option ? 'option selected' : 'option'}
                      key={option}
                    >
                      <input
                        checked={formData.identity === option}
                        name="identity"
                        onChange={() => selectAndAdvance('identity', option)}
                        type="radio"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                {errors.identity && <em>{errors.identity}</em>}
              </fieldset>
              <div className="step-actions">
                <button className="ghost-action" type="button" onClick={goBack}>
                  Back
                </button>
              </div>
            </section>
          )}

          {formStep === 3 && (
            <section className="form-step join-step page-fade" aria-label="完成登记">
              <div className="join-summary">
                <span>READY TO REGISTER</span>
                <Avatar
                  entry={{
                    fullName: formData.fullName,
                    name: formData.fullName,
                    identity: formData.identity,
                    photo: avatarPreviewUrl,
                  }}
                  className="join-avatar"
                />
                <strong>{formData.fullName || 'Unnamed Guest'}</strong>
                <p>{formData.identity || 'Identity Pending'}</p>
                <p className="join-caption">
                  提交时将写入公开 API：`name`、`role` 与拍摄头像
                </p>
              </div>
              {submitError && <p className="submit-error">{submitError}</p>}
              <div className="step-actions two-actions">
                <button className="ghost-action" type="button" onClick={goBack}>
                  Back
                </button>
                <button className="primary-action submit-action" disabled={submitting} type="submit">
                  {submitting ? 'Submitting...' : 'Submit / 提交'}
                </button>
              </div>
            </section>
          )}
        </form>
      </section>
    </main>
  )
}

function EntryCard({ entry }) {
  return (
    <article className="entry-card">
      <div className="entry-card-top">
        <span>Guest Entry Card</span>
        <b>LIVE</b>
      </div>
      <dl>
        <div>
          <dt>Avatar</dt>
          <dd>
            <Avatar entry={entry} className="card-avatar" />
          </dd>
        </div>
        <div>
          <dt>Name</dt>
          <dd>{entry.name}</dd>
        </div>
        <div>
          <dt>Identity</dt>
          <dd>{entry.identity || 'Unknown'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>Registered</dd>
        </div>
      </dl>
    </article>
  )
}

function SuccessPage({ entry, onReturnHome }) {
  useEffect(() => {
    const timer = window.setTimeout(onReturnHome, 2000)
    return () => window.clearTimeout(timer)
  }, [onReturnHome])

  return (
    <main className="screen success-screen">
      <AmbientStage />
      <section className="success-shell page-fade">
        <p className="eyebrow">REGISTERED</p>
        <h1>
          You are now checked in.
          <span>你已完成来宾登记。</span>
        </h1>
        <EntryCard entry={entry} />
        <p className="look-up">请抬头看向大屏，等待现场互动开始。</p>
        <button className="ghost-action" type="button" onClick={onReturnHome}>
          Back to Guest List
        </button>
      </section>
    </main>
  )
}

function App() {
  const [isInviteExpired] = useState(isExpiredInvite)
  const [step, setStep] = useState('entrance')
  const [latestEntry, setLatestEntry] = useState(null)
  const [entries, setEntries] = useState(loadEntries)
  const [poster, setPoster] = useState(null)
  const [program, setProgram] = useState(null)
  const [works, setWorks] = useState([])
  const [syncMessage, setSyncMessage] = useState('syncing')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let ignore = false

    async function loadRemoteData() {
      try {
        const [remotePoster, remoteProgram, remoteWorks, remoteGuests] = await Promise.all([
          fetchActivePoster(),
          fetchProgram(),
          fetchWorks(),
          fetchGuests(),
        ])

        if (ignore) {
          return
        }

        const normalizedGuests = remoteGuests.map(normalizeGuest)
        localStorage.setItem(storageKey, JSON.stringify(normalizedGuests))
        setPoster(remotePoster)
        setProgram(remoteProgram)
        setWorks(remoteWorks)
        setEntries(normalizedGuests)
        setSyncMessage('synced')
      } catch (error) {
        console.warn('Unable to load event data', error)
        if (!ignore) {
          setSyncMessage('offline')
        }
      }
    }

    loadRemoteData()
    const interval = window.setInterval(loadRemoteData, 15000)
    return () => {
      ignore = true
      window.clearInterval(interval)
    }
  }, [])

  async function handleSubmit(entry) {
    setSubmitting(true)
    setSubmitError('')

    try {
      const uploadedSelfieUrl = await uploadGuestAvatar(entry.photo)
      const guestPayload = {
        name: entry.name,
        role: entry.role,
        photo: uploadedSelfieUrl,
      }
      const savedEntry = normalizeGuest({ ...guestPayload, ...(await createGuest(guestPayload)) })
      const nextEntries = [...entries, savedEntry]
      localStorage.setItem(storageKey, JSON.stringify(nextEntries))
      setLatestEntry(savedEntry)
      setEntries(nextEntries)
      setSyncMessage('synced')
      setStep('success')
    } catch (error) {
      console.warn('Unable to save remote guest', error)
      setSubmitError(error.message || '提交失败，请检查拍摄结果后重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="app">
      {isInviteExpired ? (
        <ExpiredPage />
      ) : (
        <>
          {step === 'entrance' && (
            <EntrancePage
              entries={entries}
              onEnter={() => setStep('form')}
              poster={poster}
              program={program}
              works={works}
            />
          )}
          {step === 'form' && (
            <CheckInForm
              onSubmit={handleSubmit}
              submitError={submitError}
              submitting={submitting}
            />
          )}
          {step === 'success' && latestEntry && (
            <SuccessPage
              entry={latestEntry}
              onReturnHome={() => {
                setLatestEntry(null)
                setSubmitError('')
                setStep('entrance')
              }}
            />
          )}
        </>
      )}
      <aside className="entry-counter" aria-label="guest sync status">
        {syncMessage === 'synced'
          ? 'live guests'
          : syncMessage === 'syncing'
            ? 'syncing guests'
            : 'cached guests'}
        : {entries.length}
      </aside>
    </div>
  )
}

export default App
