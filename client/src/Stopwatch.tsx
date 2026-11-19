import { useEffect, useId, useState } from 'react'
import { save, type Journal, type Session } from './journal'
import { duration } from './timer'

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
        <textarea id={notesId} value={notes} maxLength={10000} onChange={(e) => setNotes(e.target.value)} />
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
      </section>
      {!watch && last && (
        <section className="panel">
          <h2>Last stopwatch entry</h2>
          <p>
            {duration(Math.floor(last.measuredMs / 1000))} measured · {last.subject}
          </p>
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
            {new Date(s.startedAt).toLocaleString()} · {s.subject} · {duration(Math.floor(s.measuredMs / 1000))} measured
          </summary>
          <p>Stopped {new Date(s.endedAt!).toLocaleString()}</p>
          <StopwatchDetails entry={s} journal={journal} refresh={refresh} />
        </details>
      ))}
    </section>
  )
}
