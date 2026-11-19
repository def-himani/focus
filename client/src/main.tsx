import { useEffect, useState, useCallback, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Garden } from './Garden'
import { TimerSettings, SoundSettings } from './Settings'
import { duration, useTimer, type Preferences } from './timer'
import './style.css'

import { useAudio } from './audio'
import { AttentionPanel } from './AttentionPanel'
import { Effort, Subjects, SubjectPicker } from './Subjects'
import { History, Statistics, SessionTable } from './Reports'
import { blank, type Journal, type SessionInfo } from './journal'

function Focus() {
  const { timer, busy, error, message, update, event } = useTimer()
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
  useAudio(timer, event)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!event) return
    setNotice(
      [
        event.completion && event.completion + ' countdown complete.',
        event.coins > 0 && '+' + event.coins + (event.coins === 1 ? ' coin' : ' coins'),
      ]
        .filter(Boolean)
        .join(' '),
    )
    const timeout = setTimeout(() => setNotice(''), 9000)
    return () => clearTimeout(timeout)
  }, [event])
  const card = useRef<HTMLElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement))
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
    }
    document.addEventListener('fullscreenchange', change)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('fullscreenchange', change)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  async function toggleFullscreen() {
    if (fullscreen) {
      if (document.fullscreenElement) await document.exitFullscreen()
      setFullscreen(false)
      return
    }
    try {
      if (card.current?.requestFullscreen) await card.current.requestFullscreen()
    } catch {
      /* Fall back to a viewport-filling layout. */
    }
    setFullscreen(true)
  }
  const live = timer?.active
  const journal = live
    ? { ...stored, sessions: [live, ...stored.sessions.filter((s) => s.id !== live.id)] }
    : stored
  const previousId = draft?.subjectId ?? timer?.selectedSubjectId
  const unavailable = stored.subjects.some((s) => s.id === previousId && s.state !== 'active')
  const info = unavailable ? { subjectId: 1 } : (draft ?? { subjectId: timer?.selectedSubjectId ?? 1 })
  const previousSession = journal.sessions.find(
    (s) =>
      s.mode === 'focus' &&
      s.endedAt &&
      journal.subjects.some((subject) => subject.id === s.subjectId && subject.state === 'active'),
  )
  const nav = ['Focus', 'To-Dos', 'History', 'Statistics', 'Garden', 'Settings']
  const reportProps = { journal, subject, setSubject, refresh }
  const blocked =
    live?.interrupted ||
    live?.status === 'review' ||
    live?.status === 'choice' ||
    live?.status === 'starter-ended'
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
  useEffect(() => {
    document.documentElement.dataset.theme = prefs?.playback.theme ?? 'forest'
  }, [prefs?.playback.theme])
  const timerSettings = (
    <TimerSettings prefs={prefs} configure={configure} disabled={disabled} active={active} />
  )
  const soundSettings = prefs && (
    <SoundSettings
      settings={prefs.playback}
      disabled={disabled}
      change={(p) => configure({ playback: { ...prefs.playback, ...p } })}
    />
  )
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
        {notice && (
          <p className="completion-notice" role="status">
            {notice}
          </p>
        )}
        {view === 'Garden' && <Garden revision={timer?.revision} />}
        {view === 'Settings' && (
          <>
            <h1>Settings</h1>
            <div className="workspace">
              {timerSettings}
              {soundSettings}
            </div>
            <details className="panel">
              <summary>Local data and backups</summary>
              <p>
                Stop the API and copy the entire Focus data folder to a private backup. On macOS it lives
                in ~/Library/Application Support/Focus unless a custom data directory is configured. To
                restore, stop the API, move the current folder aside, and copy the backup into its place.
              </p>
            </details>
          </>
        )}
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
              <section
                ref={card}
                className={'timer-card' + (fullscreen ? ' expanded' : '')}
                aria-label="Countdown"
              >
                <div className="card-top">
                  <span className="subject">
                    {live?.subject ??
                      journal.subjects.find((s) => s.id === info.subjectId)?.name ??
                      (info.activity || 'General Study')}
                    {live?.title && ' · ' + live.title}
                  </span>
                  <button className="expand-button" onClick={() => void toggleFullscreen()}>
                    {fullscreen ? 'Exit full screen' : 'Full screen'}
                  </button>
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
                {fullscreen && notice && <p role="status">{notice}</p>}
                {live &&
                  timer &&
                  timer.starterTarget > 120 &&
                  !live.interrupted &&
                  ['running', 'paused', 'starter-ended', 'choice'].includes(live.status) && (
                    <button disabled={disabled} onClick={() => void update('continue')}>
                      Continue to {duration(timer.starterTarget)} total
                    </button>
                  )}
                {live?.status === 'starter-ended' && (
                  <button disabled={disabled} onClick={() => void update('finish')}>
                    Finish starter
                  </button>
                )}
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
                    {!active && !isBreak && (
                      <button
                        disabled={disabled}
                        onClick={() => void update('quick', undefined, { session: info })}
                      >
                        Just start — 2 min
                      </button>
                    )}
                    {running &&
                      !isBreak &&
                      !timer?.starterTarget &&
                      !live?.makeupTargetMs &&
                      remaining > 0 &&
                      remaining <= 300000 &&
                      (timer?.targetSeconds ?? 0) <= 86100 && (
                        <button disabled={disabled} onClick={() => void update('extend')}>
                          Just five more minutes
                        </button>
                      )}
                    {running && !!live?.offMs && !isBreak && (
                      <button
                        disabled={disabled || !!timer?.refocusMs}
                        onClick={() => void update('refocus')}
                      >
                        {timer?.refocusMs
                          ? 'Back to task · ' +
                            duration(
                              Math.ceil(
                                Math.max(0, timer.refocusMs - Math.max(0, now - timer.received)) / 1000,
                              ),
                            )
                          : 'Back to task — 2 min'}
                      </button>
                    )}
                    {!active && !isBreak && previousSession && (
                      <button
                        disabled={disabled}
                        onClick={() =>
                          void update('start', undefined, {
                            session: {
                              subjectId: previousSession.subjectId,
                              title: previousSession.title,
                              notes: previousSession.notes,
                              tags: previousSession.tags,
                            },
                          })
                        }
                      >
                        Resume {previousSession.subject}
                      </button>
                    )}
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
                {running &&
                  timer?.nextCoinMs &&
                  remaining > 0 &&
                  remaining <= 300000 &&
                  timer.nextCoinMs <= 300000 && (
                    <small>
                      Next base coin after {duration(Math.ceil(timer.nextCoinMs / 1000))} more verified
                      focus.
                    </small>
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
              <div className="focus-preferences">
                {timerSettings}
                <details className="panel">
                  <summary>Sound and appearance</summary>
                  {soundSettings}
                </details>
              </div>
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
