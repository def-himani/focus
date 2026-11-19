import { useState } from 'react'
import {
  calendarBounds,
  elapsed,
  localDate,
  save,
  type Day,
  type Journal,
  type Session,
  type SessionInfo,
} from './journal'
import { report } from './accounting'
import { Effort } from './Subjects'

const stamp = (ms: number) => new Date(ms).toLocaleString()
const time = (ms: number) => new Date(ms).toLocaleTimeString()
export function SessionTable({ rows, days }: { rows: Session[]; days: Day[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {[
              'Started',
              'Ended',
              'Study Day',
              'Subject',
              'Session title',
              'Planned',
              'Effective',
              'Off-task',
              'Paused',
              'Unverified',
              'Status',
            ].map((v) => (
              <th key={v}>{v}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{stamp(s.startedAt)}</td>
              <td>{s.endedAt ? stamp(s.endedAt) : '—'}</td>
              <td>{days.find((d) => d.id === s.studyDayId)?.label ?? 'Unrecorded'}</td>
              <td>{s.subject}</td>
              <td>{s.title || '—'}</td>
              <td>{elapsed(s.plannedSeconds * 1000)}</td>
              <td>{elapsed(s.effectiveMs)}</td>
              <td>{elapsed(s.offMs)}</td>
              <td>
                {elapsed(s.pausedMs)} ({s.pauseCount})
              </td>
              <td>{elapsed(s.unverifiedMs)}</td>
              <td>{s.interrupted ? 'Interrupted' : s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="empty">No sessions in this selection.</p>}
    </div>
  )
}
function Details({ s, journal, refresh }: { s: Session; journal: Journal; refresh: () => void }) {
  const [edit, setEdit] = useState<SessionInfo>()
  const [error, setError] = useState('')
  return (
    <details className="panel">
      <summary>
        {stamp(s.startedAt)} · {s.subject} · {s.title || 'Untitled session'}
      </summary>
      <p>
        {s.notes} {s.tags && ' · ' + s.tags}
      </p>
      <p>Study Day · {journal.days.find((d) => d.id === s.studyDayId)?.label ?? 'Unrecorded'}</p>
      <p>
        Effective target {s.effectiveMs >= s.plannedSeconds * 1000 ? 'met' : 'not met'} · Make-up focus{' '}
        {elapsed(
          s.intervals
            .filter((i) => i.makeup && i.category === 'focus')
            .reduce((a, i) => a + i.end - i.start, 0),
        )}
      </p>
      {s.intervals.map((i, n) => (
        <p key={n}>
          {stamp(i.start)} – {time(i.end)} · {i.makeup ? 'Make-up · ' : ''}
          {i.pause ? 'Pause · ' : ''}
          {i.category} · {elapsed(i.end - i.start)} {i.reason}
        </p>
      ))}
      {s.checks.map((c, n) => (
        <p key={n}>
          Check-in {stamp(c.scheduledAt)} ·{' '}
          {c.answeredAt ? c.answer + ' at ' + stamp(c.answeredAt) : 'Unanswered'} · verified boundary{' '}
          {time(c.boundary)}
        </p>
      ))}
      {edit ? (
        <form
          className="fields"
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await save('sessions/' + s.id, 'PUT', edit)
              setEdit(undefined)
              refresh()
            } catch (e) {
              setError(String(e))
            }
          }}
        >
          <label>
            Linked subject
            <select
              value={edit.subjectId}
              onChange={(e) => setEdit({ ...edit, subjectId: +e.target.value })}
            >
              {journal.subjects.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} · {v.kind}
                </option>
              ))}
            </select>
          </label>
          {(['title', 'notes', 'tags'] as const).map((key) => (
            <label key={key}>
              {key}
              <input value={edit[key]} onChange={(e) => setEdit({ ...edit, [key]: e.target.value })} />
            </label>
          ))}
          <button>Save metadata</button>
          <button type="button" onClick={() => setEdit(undefined)}>
            Cancel
          </button>
        </form>
      ) : (
        <button
          onClick={() =>
            setEdit({ subjectId: s.subjectId, title: s.title, notes: s.notes, tags: s.tags })
          }
        >
          Edit session
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  )
}

type Props = { journal: Journal; refresh: () => void; subject: number; setSubject: (id: number) => void }
function Filter({
  journal,
  subject,
  setSubject,
  allowAll = true,
}: Omit<Props, 'refresh'> & { allowAll?: boolean }) {
  return (
    <label>
      Subject
      <select value={subject} onChange={(e) => setSubject(+e.target.value)}>
        {allowAll && <option value={0}>All subjects</option>}
        {journal.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.kind}
          </option>
        ))}
      </select>
    </label>
  )
}
export function History(props: Props) {
  const [date, setDate] = useState(''),
    [term, setTerm] = useState(''),
    [status, setStatus] = useState('')
  const [start, end] = calendarBounds(date)
  const rows = props.journal.sessions.filter(
    (s) =>
      s.mode === 'focus' &&
      s.endedAt &&
      (!props.subject || s.subjectId === props.subject) &&
      (!date || (s.startedAt < end && s.endedAt >= start)) &&
      (!status || s.status === status) &&
      [s.title, s.tags, s.notes, s.subject].join(' ').toLowerCase().includes(term.toLowerCase()),
  )
  return (
    <>
      <h1>Session history</h1>
      <div className="panel fields">
        <Filter {...props} />
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Search
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Title, note or tag"
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option>completed</option>
            <option>partial</option>
          </select>
        </label>
      </div>
      <SessionTable rows={rows} days={props.journal.days} />
      <h2>Session details</h2>
      {rows.map((s) => (
        <Details key={s.id} s={s} journal={props.journal} refresh={props.refresh} />
      ))}
    </>
  )
}
function DayNote({ date, initial, refresh }: { date: string; initial: string; refresh: () => void }) {
  const [note, setNote] = useState(initial),
    [message, setMessage] = useState('')
  return (
    <details className="panel">
      <summary>Daily review note</summary>
      <form
        className="fields"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await save('daily-note', 'PUT', { date, note })
            setMessage('Saved')
            refresh()
          } catch (e) {
            setMessage(String(e))
          }
        }}
      >
        <label>
          Note for {date}
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setMessage('')
            }}
          />
        </label>
        <button>Save note</button>
        <small role="status">{message}</small>
      </form>
    </details>
  )
}
function PersonalForm({ refresh }: { refresh: () => void }) {
  const [error, setError] = useState('')
  return (
    <details className="panel">
      <summary>Add personal time</summary>
      <form
        className="fields"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          const data = new FormData(form)
          try {
            await save('personal', 'POST', {
              id: crypto.randomUUID(),
              label: data.get('label'),
              start: +new Date(String(data.get('start'))),
              end: +new Date(String(data.get('end'))),
            })
            setError('')
            form.reset()
            refresh()
          } catch (e) {
            setError(String(e))
          }
        }}
      >
        <label>
          Activity
          <input required name="label" placeholder="Sleep, meal, exercise…" />
        </label>
        <label>
          From
          <input required name="start" type="datetime-local" />
        </label>
        <label>
          Until
          <input required name="end" type="datetime-local" />
        </label>
        <button>Save time</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </details>
  )
}
function Metrics({ data }: { data: ReturnType<typeof report> }) {
  const metrics = [
    ['Planned', data.planned],
    ['Effective focus', data.totals.focus],
    ['Off-task', data.totals['off-task']],
    ['Pause time', data.paused],
    ['Unverified', data.totals.unverified],
    ['Scheduled break', data.totals.break],
    ['Make-up focus', data.makeup],
  ] as const
  return (
    <div className="metrics">
      {metrics.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{elapsed(value)}</strong>
        </div>
      ))}
      <div>
        <small>Pauses</small>
        <strong>{data.pauses}</strong>
      </div>
      <div>
        <small>Completed / partial</small>
        <strong>
          {data.completed} / {data.partial}
        </strong>
      </div>
    </div>
  )
}
export function Statistics(props: Props) {
  const { journal, subject } = props
  const [mode, setMode] = useState('calendar'),
    [date, setDate] = useState(localDate(Date.now())),
    [dayId, setDay] = useState(0)
  const day = journal.days.find((d) => d.id === dayId) ?? journal.days[0]
  const calendar = calendarBounds(date)
  const start = mode === 'study' ? (day?.start ?? Date.now()) : mode === 'subject' ? 0 : calendar[0]
  const end =
    mode === 'study'
      ? (day?.end ?? Date.now() + 1)
      : mode === 'subject'
        ? Date.now() + 1
        : Math.min(Date.now() + 1, calendar[1])
  const selectedSubject = mode === 'subject' ? subject || journal.subjects[0]?.id || 1 : subject
  const data = report(journal, start, end, selectedSubject, mode === 'study' ? day?.id : 0)
  const today = localDate(Date.now())
  const showingToday = mode === 'calendar' && date === today && !subject
  const todayData = showingToday ? data : report(journal, calendarBounds(today)[0], Date.now() + 1)
  const selected = journal.subjects.find((s) => s.id === selectedSubject)
  return (
    <>
      <h1>Statistics</h1>
      <h2>Today</h2>
      <Metrics data={todayData} />
      <div className="panel fields">
        <label>
          Report
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="calendar">Calendar day</option>
            <option value="study">Study Day</option>
            <option value="subject">Subject across all dates</option>
          </select>
        </label>
        {mode === 'calendar' && (
          <label>
            Local date
            <input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value)
              }}
            />
          </label>
        )}
        {mode === 'study' && (
          <label>
            Study Day
            <select value={day?.id ?? ''} onChange={(e) => setDay(+e.target.value)}>
              {journal.days.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.label} · {time(d.start)} · {d.end ? 'closed' : 'open'} ({d.zone})
                </option>
              ))}
            </select>
          </label>
        )}
        <Filter {...props} subject={selectedSubject} allowAll={mode !== 'subject'} />
      </div>
      {!showingToday && <Metrics data={data} />}
      {selected && <Effort subject={selected} journal={journal} />}
      <section className="panel">
        <h2>Focus by subject</h2>
        {Array.from(data.bySubject, ([id, ms]) => (
          <p key={id}>
            {journal.subjects.find((s) => s.id === id)?.name} · {elapsed(ms)}
          </p>
        ))}
      </section>
      <section className="panel">
        <h2>Time accounting</h2>
        <div className="timeline" aria-hidden="true">
          {data.timeline.map((s, i) => (
            <i key={i} data-kind={s.category} style={{ flexGrow: s.end - s.start }} />
          ))}
        </div>
        <div className="timeline-list">
          {data.timeline.map((s, i) => (
            <p key={i}>
              <b data-kind={s.category} />
              {stamp(s.start)} – {time(s.end)} · {s.category}{' '}
              {s.label.toLowerCase() !== s.category && ' · ' + s.label} · {elapsed(s.end - s.start)}
            </p>
          ))}
        </div>
      </section>
      <PersonalForm refresh={props.refresh} />
      {mode === 'calendar' && (
        <DayNote
          key={date + (journal.notes.find((n) => n.date === date)?.note ?? '')}
          date={date}
          initial={journal.notes.find((n) => n.date === date)?.note ?? ''}
          refresh={props.refresh}
        />
      )}
      <h2>Sessions</h2>
      <SessionTable rows={data.sessions} days={journal.days} />
      {data.sessions.map((s) => (
        <Details key={s.id} s={s} journal={journal} refresh={props.refresh} />
      ))}
    </>
  )
}
