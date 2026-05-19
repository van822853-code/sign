import { useState } from 'react'
import './index.css'

const identityOptions = ['老师', '本课程同学', '其他学生', '其他观众']

const feelingOptions = [
  { value: '好奇 Curious', voiceType: 'Curious Voice / 好奇声部' },
  { value: '兴奋 Excited', voiceType: 'Bright Beat / 明亮节拍' },
  { value: '混乱 Confused', voiceType: 'Glitch Note / 故障音符' },
  { value: '害怕 Afraid', voiceType: 'Soft Error / 柔软报错' },
  { value: '想试试 Ready to Try', voiceType: 'Ready Input / 待生成输入' },
]

const storageKey = 'ensemble-check-in-entries'
const stepLabels = ['NAME', 'ROLE', 'FEELING', 'PROMPT', 'JOIN']

function getVoiceType(aiFeeling) {
  return (
    feelingOptions.find((option) => option.value === aiFeeling)?.voiceType ||
    'Unknown Signal / 未知声部'
  )
}

function saveEntry(entry) {
  const existingEntries = JSON.parse(localStorage.getItem(storageKey) || '[]')
  const nextEntries = [...existingEntries, entry]
  localStorage.setItem(storageKey, JSON.stringify(nextEntries))
  return nextEntries
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
    'M-30 590 C130 510 120 360 250 310 S380 200 505 250 665 470 830 350 980 310',
    'M40 720 C190 620 285 705 382 585 510 425 610 690 790 520 930 430',
    'M120 85 C260 170 185 300 330 330 475 380 430 505 610 535 735 566 750 430 960 365',
    'M-20 250 C110 205 180 160 255 220 340 295 455 110 555 180 675 252 720 120 920 92',
    'M260 850 C340 710 505 768 588 632 720 415 850 630 1000 515',
    'M25 430 L160 515 L285 475 L390 610 L520 565 L670 730 L830 690 L985 780',
    'M690 -40 C625 125 760 260 690 390 610 540 685 660 640 860',
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
      <div className="hud-panel hud-top">
        <span>SCREEN ROUTING / 屏幕选择</span>
        <b>D1 / DISPLAY</b>
        <i />
      </div>
      <div className="hud-panel hud-bottom">
        <span>WEBGL DEBUG / 调试</span>
        <b>POINTS 123,900</b>
        <b>LINES 21,244</b>
      </div>
    </div>
  )
}

function SignalPills() {
  return (
    <div className="signal-pills" aria-hidden="true">
      <span>System Loading...</span>
      <span>Voices Joining...</span>
      <span>Visual / Interaction / Sound</span>
    </div>
  )
}

function EntrancePage({ onEnter }) {
  return (
    <main className="screen entrance-screen">
      <AmbientStage />
      <section className="hero-panel page-fade">
        <SignalPills />
        <p className="eyebrow">AI GENERATIVE LIVE SHOW</p>
        <h1 className="glitch-title" data-text="合奏 Ensemble">
          合奏 Ensemble
        </h1>
        <p className="subtitle">视觉、交互与音乐的 AI 生成现场</p>
        <p className="intro">在进入现场之前，请留下你的一个声部。</p>
        <div className="loading-track" aria-hidden="true">
          <span />
        </div>
        <button className="primary-action" type="button" onClick={onEnter}>
          Enter / 进入合奏
        </button>
        <div className="terminal-line" aria-hidden="true">
          <span>&gt; awaiting audience input</span>
          <i />
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
          This Ensemble entrance has expired.
          <span>本次合奏入口已失效。</span>
        </h1>
        <p className="look-up">请向现场工作人员获取新的签到二维码。</p>
      </section>
    </main>
  )
}

function CheckInForm({ onSubmit }) {
  const [formStep, setFormStep] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    identity: '',
    aiFeeling: '',
    promptWish: '',
  })
  const [errors, setErrors] = useState({})

  function updateField(field, value) {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  function validateStep(step = formStep) {
    const nextErrors = {}

    if (step === 0 && !formData.name.trim()) {
      nextErrors.name = '请输入你的姓名或昵称'
    }

    if (step === 1 && !formData.identity) {
      nextErrors.identity = '请选择身份'
    }

    if (step === 2 && !formData.aiFeeling) {
      nextErrors.aiFeeling = '请选择你现在面对 AI 的感觉'
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

    if (!formData.name.trim()) {
      setFormStep(0)
      setErrors({ name: '请输入你的姓名或昵称' })
      return
    }

    if (!formData.identity) {
      setFormStep(1)
      setErrors({ identity: '请选择身份' })
      return
    }

    if (!formData.aiFeeling) {
      setFormStep(2)
      setErrors({ aiFeeling: '请选择你现在面对 AI 的感觉' })
      return
    }

    const entry = {
      name: formData.name.trim(),
      identity: formData.identity,
      aiFeeling: formData.aiFeeling,
      promptWish: formData.promptWish.trim(),
      voiceType: getVoiceType(formData.aiFeeling),
      timestamp: new Date().toISOString(),
    }

    saveEntry(entry)
    onSubmit(entry)
  }

  return (
    <main className="screen form-screen">
      <AmbientStage />
      <section className="form-shell page-fade">
        <SignalPills />
        <div className="section-heading">
          <p className="eyebrow">CHECK-IN SIGNAL</p>
          <h1>Leave Your Voice / 留下你的声部</h1>
          <p>
            你的输入将成为现场合奏的一部分，并可能在“声成”与“回响”环节中出现。
          </p>
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
                  onChange={(event) => updateField('name', event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      goNext()
                    }
                  }}
                  placeholder="请输入你的姓名或昵称"
                  value={formData.name}
                />
                {errors.name && <em>{errors.name}</em>}
              </label>
              <button className="primary-action submit-action" type="button" onClick={goNext}>
                Continue / 继续
              </button>
            </section>
          )}

          {formStep === 1 && (
            <section className="form-step page-fade" aria-label="身份">
              <fieldset className="field-block">
                <legend>身份</legend>
                <div className="option-grid identity-grid">
                  {identityOptions.map((option) => (
                    <label
                      className={
                        formData.identity === option ? 'option selected' : 'option'
                      }
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

          {formStep === 2 && (
            <section className="form-step page-fade" aria-label="AI 感觉">
              <fieldset className="field-block">
                <legend>你现在面对 AI 的感觉是？</legend>
                <div className="option-grid feeling-grid">
                  {feelingOptions.map((option) => (
                    <label
                      className={
                        formData.aiFeeling === option.value ? 'option selected' : 'option'
                      }
                      key={option.value}
                    >
                      <input
                        checked={formData.aiFeeling === option.value}
                        name="aiFeeling"
                        onChange={() => selectAndAdvance('aiFeeling', option.value)}
                        type="radio"
                      />
                      <span>{option.value}</span>
                    </label>
                  ))}
                </div>
                {errors.aiFeeling && <em>{errors.aiFeeling}</em>}
              </fieldset>
              <div className="step-actions">
                <button className="ghost-action" type="button" onClick={goBack}>
                  Back
                </button>
              </div>
            </section>
          )}

          {formStep === 3 && (
            <section className="form-step page-fade" aria-label="生成愿望">
              <label className="field-block focus-field">
                <span>我希望 AI 帮我生成：</span>
                <textarea
                  autoFocus
                  onChange={(event) => updateField('promptWish', event.target.value)}
                  placeholder="例如：一段音乐 / 一个网页 / 一个梦 / 一个新的想法"
                  rows="5"
                  value={formData.promptWish}
                />
              </label>
              <div className="step-actions two-actions">
                <button className="ghost-action" type="button" onClick={goBack}>
                  Back
                </button>
                <button className="primary-action" type="button" onClick={goNext}>
                  Continue / 继续
                </button>
              </div>
            </section>
          )}

          {formStep === 4 && (
            <section className="form-step join-step page-fade" aria-label="加入合奏">
              <div className="join-summary">
                <span>READY TO JOIN</span>
                <strong>{formData.name || 'Unnamed Voice'}</strong>
                <p>{getVoiceType(formData.aiFeeling)}</p>
              </div>
              <div className="step-actions two-actions">
                <button className="ghost-action" type="button" onClick={goBack}>
                  Back
                </button>
                <button className="primary-action submit-action" type="submit">
                  Join the Ensemble / 加入合奏
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
        <span>Ensemble Entry Card</span>
        <b>LIVE</b>
      </div>
      <dl>
        <div>
          <dt>Name</dt>
          <dd>{entry.name}</dd>
        </div>
        <div>
          <dt>Voice</dt>
          <dd>{entry.voiceType}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>Ready to Generate</dd>
        </div>
      </dl>
    </article>
  )
}

function SuccessPage({ entry, onRestart }) {
  return (
    <main className="screen success-screen">
      <AmbientStage />
      <section className="success-shell page-fade">
        <p className="eyebrow">VOICE JOINED</p>
        <h1>
          You are now part of the Ensemble.
          <span>你已加入合奏。</span>
        </h1>
        <EntryCard entry={entry} />
        <p className="look-up">请抬头看向大屏，等待合奏开始。</p>
        <button className="ghost-action" type="button" onClick={onRestart}>
          Add Another Voice
        </button>
      </section>
    </main>
  )
}

function App() {
  const [isInviteExpired] = useState(isExpiredInvite)
  const [step, setStep] = useState('entrance')
  const [latestEntry, setLatestEntry] = useState(null)
  const [entryCount, setEntryCount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]').length
    } catch {
      return 0
    }
  })

  function handleSubmit(entry) {
    setLatestEntry(entry)
    setEntryCount((current) => current + 1)
    setStep('success')
  }

  return (
    <div className="app">
      {isInviteExpired ? (
        <ExpiredPage />
      ) : (
        <>
          {step === 'entrance' && <EntrancePage onEnter={() => setStep('form')} />}
          {step === 'form' && <CheckInForm onSubmit={handleSubmit} />}
          {step === 'success' && latestEntry && (
            <SuccessPage
              entry={latestEntry}
              onRestart={() => {
                setLatestEntry(null)
                setStep('form')
              }}
            />
          )}
        </>
      )}
      <aside className="entry-counter" aria-label="local entry count">
        local voices: {entryCount}
      </aside>
    </div>
  )
}

export default App
