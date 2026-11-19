import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DurationPicker } from './DurationPicker'
import { duration, useTimer, type Preferences, type Session } from './timer'
import './style.css'

function RecentSessions({ rows }: { rows: Session[] }) {
  const dateTime = (timestamp: number) => new Date(timestamp).toLocaleString(undefined,
    { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })
  return <section id="sessions" className="history">
    <h2>Recent sessions</h2>
    <div className="table-scroll"><table><thead><tr>
      {['Started', 'Ended', 'Subject', 'Planned', 'Focused', 'Paused', 'Status'].map(h => <th key={h}>{h}</th>)}
    </tr></thead><tbody>{rows.map(r => <tr key={r.id}>
      <td>{dateTime(r.startedAt)}</td><td>{dateTime(r.endedAt)}</td><td>General Study</td>
      <td>{duration(r.plannedSeconds)}</td><td>{duration(Math.floor(r.effectiveMs / 1000))}</td>
      <td>{duration(Math.floor(r.pausedMs / 1000))}</td><td>{r.status === 'completed' ? 'Completed' : 'Partial'}</td>
    </tr>)}</tbody></table></div>
    {!rows.length && <p className="empty">Saved focus sessions will appear here.</p>}
  </section>
}

function Focus() {
  const { timer, busy, error, update } = useTimer()
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (timer?.status !== 'running') return
    const id = setInterval(() => setNow(performance.now()), 150)
    return () => clearInterval(id)
  }, [timer?.status])
  const running = timer?.status === 'running'
  const paused = timer?.status === 'paused'
  const active = running || paused
  const isBreak = timer?.mode === 'break'
  const remaining = timer ? Math.max(0, timer.remainingMs -
    (running ? Math.max(0, now - timer.received) : 0)) : 2400000
  const fraction = timer ? remaining / (timer.plannedSeconds * 1000) : 1
  const disabled = !timer || busy || error
  const prefs = timer?.preferences
  function configure(changes: Partial<Preferences>) {
    if (prefs) void update('settings', { ...prefs, ...changes })
  }
  return <>
    <header><div className="bar"><a href="#timer" className="brand"><i aria-hidden="true" />Focus</a>
      <span className="connection" role="status"><b className={timer && !error ? 'online' : ''} />
        {error ? 'Local API unavailable' : timer ? 'Connected to the local API' : 'Connecting…'}</span>
    </div></header>
    <main><h1 id="timer">Session timer</h1>
      <div className="workspace">
        <section className="timer-card" aria-label="Countdown">
          <div className="card-top"><span className="subject">General Study</span>
            <span className="state">{paused ? 'Paused' : running ? 'Running' : 'Ready'}</span></div>
          <div className="dial" style={{ '--angle': (fraction * 360) + 'deg' } as React.CSSProperties}>
            <div className="dial-face"><span className="mode">{isBreak ? 'Break' : 'Focus'}</span>
              <strong role="timer">{duration(Math.ceil(remaining / 1000))}</strong>
            </div>
          </div>
          <div className="actions"><button className="primary" disabled={disabled}
            onClick={() => void update(running ? 'pause' : paused ? 'resume' : 'start')}>
            <span aria-hidden="true">{running ? 'Ⅱ' : '▶'}</span>
            {running ? 'Pause' : paused ? 'Resume' : isBreak ? 'Start break' : 'Start focus'}
          </button>
          {active && !isBreak && <button disabled={disabled} onClick={() => void update('stop')}>Stop &amp; save</button>}
          {isBreak && <button disabled={disabled} onClick={() => void update('skip')}>Skip break</button>}
          {(active || isBreak) && <button disabled={disabled} onClick={() => {
            if (window.confirm('Return to the focus timer? Elapsed time will be saved.')) void update('reset')
          }}>Reset</button>}</div>
        </section>
        <aside><h2>Timer settings</h2>
          <fieldset disabled={disabled} className="settings">
            <DurationPicker label="Focus" presets={[30, 40, 50, 60]} seconds={prefs?.focusSeconds ?? 2400}
              onChange={focusSeconds => configure({ focusSeconds })} />
            <DurationPicker label="Break" presets={[5, 10]} seconds={prefs?.breakSeconds ?? 300}
              onChange={breakSeconds => configure({ breakSeconds })} />
            {active && <small>Duration changes apply to the next block.</small>}
            <div className="switches">{([
              ['loop', 'Repeat cycle'], ['autoBreak', 'Auto-start break'], ['autoFocus', 'Auto-start next focus'],
            ] as const).map(([key, label]) => <label key={key}>{label}<input type="checkbox" role="switch"
              checked={prefs?.[key] ?? true} disabled={key === 'autoFocus' && !prefs?.loop}
              onChange={e => configure({ [key]: e.target.checked })} /></label>)}</div>
          </fieldset>
        </aside>
      </div>
      <RecentSessions rows={timer?.history ?? []} />
    </main>
  </>
}
createRoot(document.getElementById('root')!).render(<Focus />)
