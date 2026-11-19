import { useEffect, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { DurationPicker } from './DurationPicker'
import { duration, useTimer, type Preferences } from './timer'
import './style.css'

import { usePromptChime } from './promptChime'
import { AttentionPanel } from './AttentionPanel'
import { Effort, Subjects, SubjectPicker } from './Subjects'
import { History, Statistics, SessionTable } from './Reports'
import { blank, type Journal, type SessionInfo } from './journal'

function Focus() {
  const { timer, busy, error, message, update } = useTimer()
  const [view, setView] = useState('Focus')
  const [stored, setJournal] = useState<Journal>(blank)
  const [journalError, setJournalError] = useState('')
  const [subject, setSubject] = useState(0)
  const [draft, setDraft] = useState<SessionInfo>()
  const [serial, setSerial] = useState(0)
  const refresh = useCallback(() => setSerial((n) => n + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/journal', { signal: controller.signal })
        if (!response.ok) throw Error()
        setJournal(await response.json())
        setJournalError('')
      } catch {
        if (!controller.signal.aborted) setJournalError('Could not load the journal.')
      }
    }
    void load()
    return () => controller.abort()
  }, [timer?.revision, serial, view])
  useEffect(() => {
    const channel = new BroadcastChannel('focus-journal')
    channel.onmessage = refresh
    window.addEventListener('focus', refresh)
    return () => {
      channel.close()
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])
  usePromptChime(timer)
  const live = timer?.active
  const journal = live
    ? { ...stored, sessions: [live, ...stored.sessions.filter((s) => s.id !== live.id)] }
    : stored
  const previousId = draft?.subjectId ?? timer?.selectedSubjectId
  const unavailable = stored.subjects.some((s) => s.id === previousId && s.state !== 'active')
  const info = unavailable ? { subjectId: 1 } : (draft ?? { subjectId: timer?.selectedSubjectId ?? 1 })
  const nav = ['Focus', 'To-Dos', 'History', 'Statistics']
  const reportProps = { journal, subject, setSubject, refresh }
  const blocked = live?.interrupted || live?.status === 'review' || live?.status === 'choice'
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (timer?.status !== 'running' || view !== 'Focus') return
    const id = setInterval(() => setNow(performance.now()), 150)
    return () => clearInterval(id)
  }, [timer?.status, view])
  const running = timer?.status === 'running'
  const paused = timer?.status === 'paused'
  const active = running || paused
  const isBreak = timer?.mode === 'break'
  const remaining = timer
    ? Math.max(0, timer.remainingMs - (running ? Math.max(0, now - timer.received) : 0))
    : 2400000
  const fraction = timer ? remaining / timer.phaseTargetMs : 1
  const disabled = !timer || busy || error
  const prefs = timer?.preferences
  function configure(changes: Partial<Preferences>) {
    if (prefs) void update('settings', { ...prefs, ...changes })
  }
  return (
    <>
      <header>
        <div className="bar">
          <a href="#timer" onClick={() => setView('Focus')} className="brand">
            <i aria-hidden="true" />
            Focus
          </a>
          <span className="connection" role="status">
            <b className={timer && !error ? 'online' : ''} />
            {error ? 'Local API unavailable' : timer ? 'Connected to the local API' : 'Connecting…'}
          </span>
        </div>
      </header>
      <nav aria-label="Views">
        {nav.map((v) => (
          <button key={v} aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)}>
            {v}
          </button>
        ))}
      </nav>
      <main>
        {journalError && (
          <p role="alert">
            {journalError} <button onClick={refresh}>Retry</button>
          </p>
        )}
        {message && <p role="alert">{message}</p>}
        {view !== 'Focus' && timer && (blocked || live?.checks.some((c) => c.answeredAt === null)) && (
          <AttentionPanel
            timer={timer}
            disabled={disabled}
            act={(action, data) => void update(action, undefined, data)}
          />
        )}
        {view === 'To-Dos' && (
          <Subjects
            journal={journal}
            refresh={refresh}
            onHistory={(id) => {
              setSubject(id)
              setView('History')
            }}
          />
        )}
        {view === 'History' && <History {...reportProps} />}
        {view === 'Statistics' && <Statistics {...reportProps} />}
        {view === 'Focus' && (
          <>
            <div className="focus-heading">
              <h1 id="timer">Session timer</h1>
              <fieldset className="overlay">
                <legend>TO DO</legend>
                <div>
                  {journal.subjects
                    .filter((s) => s.kind === 'todo' && s.state === 'active')
                    .map((s) => (
                      <p key={s.id} title={s.name}>
                        {s.name}
                      </p>
                    ))}
                  {!journal.subjects.some((s) => s.kind === 'todo' && s.state === 'active') && (
                    <small>No outstanding to-dos</small>
                  )}
                </div>
              </fieldset>
            </div>
            {!live && <SubjectPicker journal={journal} info={info} change={setDraft} disabled={busy} />}
            {live && journal.subjects.find((s) => s.id === live.subjectId) && (
              <Effort
                journal={journal}
                subject={journal.subjects.find((s) => s.id === live.subjectId)!}
              />
            )}
            <div className="workspace">
              <section className="timer-card" aria-label="Countdown">
                <div className="card-top">
                  <span className="subject">
                    {live?.subject ??
                      journal.subjects.find((s) => s.id === info.subjectId)?.name ??
                      (info.activity || 'General Study')}
                    {live?.title && ' · ' + live.title}
                  </span>
                  <span className="state">
                    {blocked
                      ? live?.interrupted
                        ? 'Interrupted'
                        : live?.status
                      : paused
                        ? 'Paused'
                        : running
                          ? 'Running'
                          : 'Ready'}
                  </span>
                </div>
                <div
                  className="dial"
                  style={{ '--angle': fraction * 360 + 'deg' } as React.CSSProperties}
                >
                  <div className="dial-face">
                    <span className="mode">
                      {live?.makeupTargetMs ? 'Make-up' : isBreak ? 'Break' : 'Focus'}
                    </span>
                    <strong role="timer">{duration(Math.ceil(remaining / 1000))}</strong>
                  </div>
                </div>
                {!blocked && (
                  <div className="actions">
                    <button
                      className="primary"
                      disabled={disabled}
                      onClick={() =>
                        void update(
                          running ? 'pause' : paused ? 'resume' : 'start',
                          undefined,
                          !active ? { session: info } : undefined,
                        )
                      }
                    >
                      <span aria-hidden="true">{running ? 'Ⅱ' : '▶'}</span>
                      {running ? 'Pause' : paused ? 'Resume' : isBreak ? 'Start break' : 'Start focus'}
                    </button>
                    {active && !isBreak && (
                      <button disabled={disabled} onClick={() => void update('stop')}>
                        Stop &amp; save
                      </button>
                    )}
                    {isBreak && (
                      <button disabled={disabled} onClick={() => void update('skip')}>
                        Skip break
                      </button>
                    )}
                    {(active || isBreak) && (
                      <button
                        disabled={disabled}
                        onClick={() => {
                          if (window.confirm('Return to the focus timer? Elapsed time will be saved.'))
                            void update('reset')
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
                {timer && (
                  <AttentionPanel
                    key={live?.id}
                    timer={timer}
                    disabled={disabled}
                    act={(action, data) => void update(action, undefined, data)}
                  />
                )}
              </section>
              <aside>
                <h2>Timer settings</h2>
                <fieldset disabled={disabled} className="settings">
                  <DurationPicker
                    label="Focus"
                    presets={[30, 40, 50, 60]}
                    seconds={prefs?.focusSeconds ?? 2400}
                    onChange={(focusSeconds) => configure({ focusSeconds })}
                  />
                  <DurationPicker
                    label="Break"
                    presets={[5, 10]}
                    seconds={prefs?.breakSeconds ?? 300}
                    onChange={(breakSeconds) => configure({ breakSeconds })}
                  />
                  <DurationPicker
                    label="Check-in"
                    presets={[0, 5, 10, 20]}
                    seconds={prefs?.checkSeconds ?? 0}
                    onChange={(checkSeconds) => configure({ checkSeconds })}
                  />
                  {active && <small>Duration changes apply to the next block.</small>}
                  <div className="switches">
                    {(
                      [
                        ['promptSound', 'Check-in chime'],
                        ['loop', 'Repeat cycle'],
                        ['autoBreak', 'Auto-start break'],
                        ['autoFocus', 'Auto-start next focus'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <input
                          type="checkbox"
                          role="switch"
                          checked={prefs?.[key] ?? true}
                          disabled={key === 'autoFocus' && !prefs?.loop}
                          onChange={(e) => configure({ [key]: e.target.checked })}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              </aside>
            </div>
            <section className="history">
              <h2>Recent sessions</h2>
              <SessionTable rows={timer?.history ?? []} days={journal.days} />
            </section>
            <button
              disabled={Boolean(live?.interrupted) || busy || !journal.days.some((d) => !d.end)}
              onClick={() => {
                if (confirm('End this Study Day and save any current session?')) void update('done')
              }}
            >
              Done for the Day
            </button>
          </>
        )}
      </main>
    </>
  )
}
createRoot(document.getElementById('root')!).render(<Focus />)
