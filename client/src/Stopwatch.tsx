import { useEffect, useId, useRef, useState } from 'react'
import { addedSeconds, timeRange, save, type Journal, type Session } from './journal'
import { duration } from './timer'

function Adjustments({
  entry,
  measuredMs,
  refresh,
}: {
  entry: Session
  measuredMs: number
  refresh: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<{ key: string; seconds: number } | null>(null)
  async function add(seconds: number) {
    if (busy) return
    if (!pending.current || pending.current.seconds !== seconds)
      pending.current = { key: crypto.randomUUID(), seconds }
    setBusy(true)
    try {
      await save('stopwatch/' + entry.id + '/adjustments/' + pending.current.key, 'PUT', { seconds })
      pending.current = null
      setError('')
      refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  const added = addedSeconds(entry)
  return (
    <div className="manual-adjustments">
      <p>
        Manually added <strong>{duration(added)}</strong> · Total{' '}
        {duration(Math.floor(measuredMs / 1000) + added)}
      </p>
      <div className="chips">
        {[30, 60].map((seconds) => (
          <button key={seconds} disabled={busy} onClick={() => void add(seconds)}>
            {seconds === 30 ? '+30s' : '+1m'}
          </button>
        ))}
      </div>
      {entry.adjustments.length > 0 && (
        <details>
          <summary>Adjustment history</summary>
          {entry.adjustments.map((a) => (
            <p key={a.id}>
              {new Date(a.recordedAt).toLocaleString()} · +{a.seconds}s
            </p>
          ))}
        </details>
      )}
      {error && <small role="alert">{error}</small>}
    </div>
  )
}

export function StopwatchDetails({
  entry,
  journal,
  refresh,
}: {
  entry: Session
  journal: Journal
  refresh: () => void
}) {
  const notesId = useId()
  const [category, setCategory] = useState(String(entry.subjectId))
  const [name, setName] = useState('')
  const [notes, setNotes] = useState(entry.notes)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    setCategory(String(entry.subjectId))
    setNotes(entry.notes)
  }, [entry.subjectId, entry.notes])
  return (
    <form
      className="fields"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await save('stopwatch/' + entry.id, 'PUT', {
            subjectId: Number(category) || undefined,
            activity: category === 'new' ? name.trim() : undefined,
            notes,
          })
          refresh()
          setMessage('Saved')
        } catch (err) {
          setMessage(String(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="0">Uncategorized</option>
          {journal.subjects
            .filter((s) => s.state === 'active' || s.id === entry.subjectId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.kind === 'todo' ? 'To-do' : 'Activity'}
              </option>
            ))}
          <option value="new">New activity…</option>
        </select>
      </label>
      {category === 'new' && (
        <label>
          New activity name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      <div>
        <label htmlFor={notesId}>Notes</label>
        <textarea
          id={notesId}
          value={notes}
          maxLength={10000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <button disabled={busy || (category === 'new' && !name.trim())}>Save category and notes</button>
      <small role="status">{message}</small>
    </form>
  )
}

export function StopwatchPanel({
  watch,
  received,
  journal,
  disabled,
  act,
  refresh,
}: {
  watch?: Session | null
  received: number
  journal: Journal
  disabled: boolean
  act: (action: string) => void
  refresh: () => void
}) {
  const [now, setNow] = useState(() => performance.now())
  const running = watch?.status === 'running'
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(performance.now()), 150)
    return () => clearInterval(id)
  }, [running])
  const ms = (watch?.measuredMs ?? 0) + (running ? Math.max(0, now - received) : 0)
  const last = journal.sessions.find((s) => s.mode === 'stopwatch' && s.endedAt !== null)
  return (
    <>
      <section className="timer-card" aria-label="Count-up stopwatch">
        <span className="mode">{running ? 'Running' : watch ? 'Paused' : 'Stopwatch'}</span>
        <div className="dial">
          <div className="dial-face">
            <strong role="timer">{duration(Math.floor(ms / 1000))}</strong>
            <small>Measured time</small>
          </div>
        </div>
        <div className="actions">
          <button
            disabled={disabled}
            className="primary"
            onClick={() => act(!watch ? 'watch-start' : running ? 'watch-pause' : 'watch-resume')}
          >
            {!watch ? 'Start stopwatch' : running ? 'Pause stopwatch' : 'Resume stopwatch'}
          </button>
          {watch && (
            <button disabled={disabled} onClick={() => act('watch-stop')}>
              Stop and save
            </button>
          )}
        </div>
        {watch && <Adjustments key={watch.id} entry={watch} measuredMs={ms} refresh={refresh} />}
      </section>
      {!watch && last && (
        <section className="panel">
          <h2>Last stopwatch entry</h2>
          <p>
            {duration(Math.floor(last.measuredMs / 1000))} measured · {last.subject}
          </p>
          <Adjustments entry={last} measuredMs={last.measuredMs} refresh={refresh} />
          <StopwatchDetails key={last.id} entry={last} journal={journal} refresh={refresh} />
        </section>
      )}
    </>
  )
}

export function StopwatchHistory({
  entries,
  journal,
  refresh,
}: {
  entries: Session[]
  journal: Journal
  refresh: () => void
}) {
  if (!entries.length) return null
  return (
    <section>
      <h2>Stopwatch entries</h2>
      {entries.map((s) => (
        <details className="panel" key={s.id}>
          <summary>
            {new Date(s.startedAt).toLocaleDateString()} · {timeRange(s.startedAt, s.endedAt)} ·{' '}
            {s.subject} · {duration(Math.floor(s.measuredMs / 1000))} measured
          </summary>
          <Adjustments entry={s} measuredMs={s.measuredMs} refresh={refresh} />
          <StopwatchDetails entry={s} journal={journal} refresh={refresh} />
        </details>
      ))}
    </section>
  )
}
