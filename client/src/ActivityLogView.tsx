import { useMemo, useState } from 'react'
import { elapsed, timeRange, type Journal } from './journal'
import {
  accumulate,
  activityDays,
  asDate,
  classified,
  recorded,
  dateKey,
  dateSpan,
  dayName,
  dayRange,
  emptyRecorded,
  monday,
  shifted,
  shortDate,
  total,
  type Recorded,
} from './activityLog'

function Bar({ r }: { r: Recorded }) {
  return (
    <div
      className="log-bar"
      aria-label={
        'Focus ' +
        elapsed(r.focus) +
        ', distracted ' +
        elapsed(r.distracted) +
        ', stopwatch ' +
        elapsed(r.activity)
      }
    >
      {(['focus', 'distracted', 'activity'] as const).map(
        (k) =>
          r[k] > 0 && (
            <i
              key={k}
              data-kind={{ focus: 'focus', distracted: 'off-task', activity: 'stopwatch' }[k]}
              style={{ flexGrow: r[k] }}
            />
          ),
      )}
    </div>
  )
}
function Summary({ r }: { r: Recorded }) {
  const rates = classified(r)
  return (
    <div className="log-summary">
      <strong>{elapsed(total(r))} recorded</strong>
      <span className="interval-key">
        <span>
          <i data-kind="focus" /> {elapsed(r.focus)} focus
        </span>
        <span>
          <i data-kind="off-task" /> {elapsed(r.distracted)} distracted
        </span>
        <span>
          <i data-kind="stopwatch" /> {elapsed(r.activity)} stopwatch
        </span>
      </span>
      <small title="Share of explicitly classified focus and distracted time">
        {rates ? rates.focus + '% Focus / ' + rates.distracted + '% Distracted' : 'Focus / Distracted —'}
      </small>
      <Bar r={r} />
    </div>
  )
}
export function ActivityLog({
  journal,
  history,
}: {
  journal: Journal
  history: (subject: number, entry?: number) => void
}) {
  const log = useMemo(() => activityDays(journal), [journal])
  const [period, setPeriod] = useState<'Weekly' | 'Monthly'>('Weekly')
  const [anchor, setAnchor] = useState(
    () => journal.days.find((d) => !d.end)?.label ?? dateKey(new Date()),
  )
  const [selected, select] = useState<string>()
  const [selectedStudy, setStudy] = useState<number>()
  const [subject, setSubject] = useState<number>()
  const monthStart = anchor.slice(0, 7) + '-01'
  const weekly = period === 'Weekly'
  const first = weekly ? monday(anchor) : monday(monthStart)
  const nextMonth = asDate(monthStart)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const dates: string[] = []
  for (
    let d = first;
    weekly ? dates.length < 7 : d < dateKey(nextMonth) || dates.length % 7 !== 0;
    d = shifted(d, 1)
  )
    dates.push(d)
  const periodDays = dates.filter((d) => weekly || d.slice(0, 7) === anchor.slice(0, 7))
  const sums = emptyRecorded(),
    rows = new Map<number, string>()
  for (const d of periodDays) {
    const item = log.get(d)
    if (item) {
      accumulate(sums, item.totals)
      for (const s of item.sessions) rows.set(s.subjectId, s.subject)
    }
  }
  const detail = selected ? log.get(selected) : undefined
  const dayEntries =
    detail?.sessions.filter(
      (s) =>
        (subject === undefined || s.subjectId === subject) &&
        (selectedStudy === undefined || (s.studyDayId ?? 0) === selectedStudy),
    ) ?? []
  const daySum = emptyRecorded(),
    breakdown = new Map<number, Recorded>()
  for (const s of dayEntries) {
    const r = recorded(s),
      cell = breakdown.get(s.subjectId) ?? emptyRecorded()
    accumulate(daySum, r)
    accumulate(cell, r)
    breakdown.set(s.subjectId, cell)
  }
  const overnight = (key: string) =>
    log
      .get(key)
      ?.days.map((day) => dayRange(day, Date.now()))
      .filter((range) => range !== shortDate(key))
      .join(', ')
  function move(delta: number) {
    const d = asDate(monthStart)
    d.setMonth(d.getMonth() + delta)
    setAnchor(weekly ? shifted(anchor, 7 * delta) : dateKey(d))
    select(undefined)
    setSubject(undefined)
  }
  function pick(d: string, id?: number) {
    select(d)
    setSubject(id)
    setStudy(undefined)
  }
  return (
    <>
      <h1>Activity Log</h1>
      <div className="log-controls">
        <div className="chips">
          {(['Weekly', 'Monthly'] as const).map((p) => (
            <button
              aria-pressed={period === p}
              key={p}
              onClick={() => {
                setPeriod(p)
                select(undefined)
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="chips">
          <button aria-label={'Previous ' + (weekly ? 'week' : 'month')} onClick={() => move(-1)}>
            ‹
          </button>
          <strong>
            {weekly
              ? dateSpan(first, dates[6])
              : asDate(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </strong>
          <button aria-label={'Next ' + (weekly ? 'week' : 'month')} onClick={() => move(1)}>
            ›
          </button>
        </div>
      </div>
      <Summary r={sums} />
      <p className="log-caption">
        Grouped by Study Day start date. Entries without a Study Day use their local start date.
      </p>
      {weekly ? (
        <div className="table-scroll">
          <table className="log-week">
            <thead>
              <tr>
                <th>To-do / activity</th>
                {dates.map((d) => (
                  <th key={d}>
                    <button onClick={() => pick(d)}>
                      {asDate(d).toLocaleDateString('en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </button>
                    {overnight(d) && <small>{overnight(d)}</small>}
                  </th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].map(([id, name]) => (
                <tr key={id}>
                  <th>
                    <button onClick={() => history(id)}>{name}</button>
                  </th>
                  {dates.map((d) => (
                    <td key={d}>
                      {log.get(d)?.subjects.has(id) ? (
                        <button onClick={() => pick(d, id)}>
                          {elapsed(total(log.get(d)!.subjects.get(id)!))}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                  <td>
                    {elapsed(
                      dates.reduce(
                        (sum, d) => sum + total(log.get(d)?.subjects.get(id) ?? emptyRecorded()),
                        0,
                      ),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Recorded</th>
                {dates.map((d) => (
                  <td key={d}>
                    <button onClick={() => pick(d)}>
                      {log.get(d)?.sessions.length ? elapsed(total(log.get(d)!.totals)) : '—'}
                    </button>
                    <Bar r={log.get(d)?.totals ?? emptyRecorded()} />
                  </td>
                ))}
                <td>{elapsed(total(sums))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="month-scroll">
          <div className="month-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((s) => (
              <strong key={s}>{s}</strong>
            ))}
            {dates.map((d) =>
              d.slice(0, 7) !== anchor.slice(0, 7) ? (
                <span key={d} />
              ) : (
                <button key={d} aria-label={shortDate(d)} onClick={() => pick(d)}>
                  <b>{asDate(d).getDate()}</b>
                  {overnight(d) && <small>{overnight(d)}</small>}
                  <small>{log.get(d)?.sessions.length ? elapsed(total(log.get(d)!.totals)) : '—'}</small>
                  <Bar r={log.get(d)?.totals ?? emptyRecorded()} />
                </button>
              ),
            )}
          </div>
        </div>
      )}
      {!rows.size && <p>No entries in this {weekly ? 'week' : 'month'}.</p>}
      {selected && (
        <section className="panel" aria-label="Day details">
          <h2>{shortDate(selected)}</h2>
          {detail?.days.map((day) => (
            <small key={day.id}>
              {dayName(day, journal.days, Date.now())} · {dayRange(day, Date.now())}{' '}
            </small>
          ))}
          {detail && detail.days.length > 1 && (
            <label>
              Study Day{' '}
              <select
                value={selectedStudy ?? ''}
                onChange={(e) => setStudy(e.target.value ? +e.target.value : undefined)}
              >
                <option value="">All on this date</option>
                {detail.days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {dayName(d, journal.days, Date.now())} ·{' '}
                    {new Date(d.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Summary r={daySum} />
          {!detail?.sessions.length && <p>No recorded entries.</p>}
          {detail &&
            [...breakdown].map(([id, r]) => (
              <div key={id}>
                <h3>
                  {detail.sessions.find((s) => s.subjectId === id)?.subject} · {elapsed(total(r))}
                </h3>
                <button onClick={() => history(id)}>All linked sessions</button>
                {dayEntries
                  .filter((s) => s.subjectId === id)
                  .map((s) => (
                    <button className="log-entry" key={s.id} onClick={() => history(id, s.id)}>
                      {timeRange(s.startedAt, s.endedAt)} ·{' '}
                      {s.title || (s.mode === 'stopwatch' ? 'Stopwatch' : 'Pomodoro')} · View entry
                    </button>
                  ))}
              </div>
            ))}
        </section>
      )}
    </>
  )
}
