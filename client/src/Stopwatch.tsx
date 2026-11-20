import { shortDate } from './activityLog'
import { DeleteEntry } from './DeleteEntry'
import { useEffect, useId, useRef, useState, type Ref, type ReactNode } from 'react'
import { elapsed, localDate, timeRange, save, type Journal, type Session } from './journal'
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
  const [off, setOff] = useState(entry.offMs ? String(entry.offMs / 60000) : '')
  const [title, setTitle] = useState(entry.title)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    setCategory(String(entry.subjectId))
    setNotes(entry.notes)
    setOff(entry.offMs ? String(entry.offMs / 60000) : '')
    setTitle(entry.title)
  }, [entry.subjectId, entry.notes, entry.offMs, entry.title])
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
            title,
            stopwatchOffMs: Math.round(Number(off) * 60000),
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
        Distracted time (optional, minutes)
        <input
          type="number"
          min="0"
          step="any"
          max={entry.measuredMs / 60000}
          value={off}
          placeholder="0"
          onChange={(e) => setOff(e.target.value)}
        />
      </label>
      <label>
        Entry title
        <input value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
      </label>
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
      <button disabled={busy || (category === 'new' && !name.trim())}>Save entry</button>
      <small role="status">{message}</small>
    </form>
  )
}

export function StopwatchPanel({
  card,
  fullscreen,
  overlay,
  toggleFullscreen,
  watch,
  received,
  journal,
  disabled,
  act,
  refresh,
}: {
  card: Ref<HTMLElement>
  fullscreen: boolean
  overlay: ReactNode
  toggleFullscreen: () => void
  watch?: Session | null
  received: number
  journal: Journal
  disabled: boolean
  act: (action: string) => void
  refresh: () => void
}) {
  const [now, setNow] = useState(() => performance.now())
  const previousWatch = useRef(watch?.id)
  useEffect(() => {
    if (previousWatch.current && !watch && fullscreen) toggleFullscreen()
    previousWatch.current = watch?.id
  }, [watch, fullscreen, toggleFullscreen])
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
      <section
        ref={card}
        className={'timer-card' + (fullscreen ? ' expanded' : '')}
        aria-label="Count-up stopwatch"
      >
        {fullscreen && overlay}
        <button className="expand-button" onClick={toggleFullscreen}>
          {fullscreen ? 'Exit full screen' : 'Full screen'}
        </button>
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
            {elapsed(last.measuredMs - last.offMs)} activity · {elapsed(last.offMs)} distracted ·{' '}
            {last.subject}
          </p>

          <StopwatchDetails key={last.id} entry={last} journal={journal} refresh={refresh} />
        </section>
      )}
    </>
  )
}

export function StopwatchHistory({
  entries,
  entryId,
  journal,
  refresh,
}: {
  entryId?: number
  entries: Session[]
  journal: Journal
  refresh: () => void
}) {
  if (!entries.length) return null
  return (
    <section>
      <h2>Stopwatch entries</h2>
      {entries.map((s) => (
        <details className="panel" key={s.id} id={'entry-' + s.id} open={entryId === s.id || undefined}>
          <summary>
            {shortDate(localDate(s.startedAt))} · {timeRange(s.startedAt, s.endedAt)} · {s.subject} ·{' '}
            {elapsed(s.measuredMs - s.offMs)} activity · {elapsed(s.offMs)} distracted
          </summary>
          <p>{s.title}</p>
          <details>
            <summary>Exact timing</summary>
            <p>
              {new Date(s.startedAt).toLocaleString()} – {new Date(s.endedAt!).toLocaleString()} ·{' '}
              {s.measuredMs / 1000} seconds measured
            </p>
          </details>
          <StopwatchDetails entry={s} journal={journal} refresh={refresh} />
          <DeleteEntry id={s.id} refresh={refresh} />
        </details>
      ))}
    </section>
  )
}
