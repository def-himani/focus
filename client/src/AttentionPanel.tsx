import { useState } from 'react'
import { elapsed } from './journal'
import type { Snapshot, CommandData } from './timer'

export function AttentionPanel({
  timer,
  act,
  disabled,
}: {
  timer: Snapshot
  act: (action: string, data?: CommandData) => void
  disabled: boolean
}) {
  const [reporting, setReporting] = useState(false)
  const [minutes, setMinutes] = useState('')
  const s = timer.active
  if (!s) return null
  const prompt = s.checks.find((c) => c.answeredAt === null)
  const review = s.status === 'review'
  const offMs = Math.round(Number(minutes) * 60000)
  const submit = (action: string, data?: CommandData) => {
    act(action, data)
    setReporting(false)
  }
  if (timer.recoveries.length > 0)
    return (
      <section className="panel attention">
        <h2>Interrupted sessions</h2>
        {timer.recoveries.map((r) => (
          <div key={r.id}>
            <p>
              {r.title || 'Session'} · {new Date(r.startedAt).toLocaleString()}
            </p>
            <button
              disabled={disabled || timer.recoveries.length > 1}
              onClick={() => act('resume', { blockId: r.id })}
            >
              Resume
            </button>
            <button disabled={disabled} onClick={() => act('reset', { blockId: r.id })}>
              Close &amp; save partial
            </button>
          </div>
        ))}
        {timer.recoveries.length > 1 && (
          <button
            onClick={() => {
              if (confirm('Close and save all interrupted sessions?')) act('close-all')
            }}
          >
            Close all
          </button>
        )}
      </section>
    )
  if (s.status === 'choice')
    return (
      <section className="panel attention">
        <h2>Countdown complete</h2>
        <p>
          {elapsed(s.effectiveMs)} focused · {elapsed(s.offMs)} off-task
        </p>
        <button disabled={disabled} onClick={() => act('makeup')}>
          Make up {elapsed(s.targetSeconds * 1000 - s.effectiveMs)}
        </button>
        <button disabled={disabled} onClick={() => act('finish')}>
          Finish session
        </button>
      </section>
    )
  if (s.mode === 'break') return null
  return (
    <fieldset disabled={disabled} className="attention">
      {(prompt || review) && (
        <section aria-live="polite">
          <h2>{review ? 'Review your focus time' : 'Still studying?'}</h2>
          <p>
            {elapsed(s.unverifiedMs)} unverified ·{' '}
            {new Date(prompt?.boundary ?? s.startedAt).toLocaleTimeString()} –{' '}
            {new Date(
              review ? Math.max(...s.intervals.map((i) => i.end)) : s.lastObservedAt,
            ).toLocaleTimeString()}
          </p>
          <button onClick={() => submit('answer')}>{review ? 'All focused' : 'Yes'}</button>
          <button onClick={() => setReporting(true)}>{review ? 'Mixed' : 'No, I got distracted'}</button>
          {review && <button onClick={() => submit('answer', { allOff: true })}>All off-task</button>}
        </section>
      )}
      {!review && !prompt && s.status === 'running' && (
        <button onClick={() => setReporting(!reporting)}>Report distraction</button>
      )}
      {reporting && (
        <form
          className="fields"
          onSubmit={(e) => {
            e.preventDefault()
            submit(prompt || review ? 'answer' : 'distraction', { offMs })
          }}
        >
          <label>
            Most recent off-task minutes
            <input
              type="number"
              min="0.001"
              step="any"
              required
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          {(prompt || review) && (
            <small>The remaining unverified running time will count as focused.</small>
          )}
          <button>Save classification</button>
        </form>
      )}
      {s.status === 'paused' && (
        <label>
          Pause reason
          <select
            value={s.intervals.filter((i) => i.pause).at(-1)?.reason ?? ''}
            onChange={(e) => act('classify-pause', { reason: e.target.value })}
          >
            <option value="">Unclassified</option>
            {['Off-task', 'Necessary interruption', 'Rest'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
      )}
      {(s.pauseCount > 0 || s.offMs > 0) && (
        <small>
          {s.pauseCount} pauses · {elapsed(s.pausedMs)} paused · {elapsed(s.offMs)} off-task
        </small>
      )}
    </fieldset>
  )
}
