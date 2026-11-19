import { useState, useRef } from 'react'
import { elapsed, progress, save, type Journal, type SessionInfo, type Subject } from './journal'

export function Effort({ subject, journal }: { subject: Subject; journal: Journal }) {
  if (!subject.estimateMinutes) return null
  const { used, percent } = progress(subject, journal.sessions)
  return (
    <div className="effort">
      <progress max={100} value={Math.min(100, percent)} aria-label="Estimated effort used" />
      <small>
        {elapsed(used)} / {elapsed(subject.estimateMinutes * 60000)} · {percent.toFixed(1)}% of estimated
        effort used
      </small>
    </div>
  )
}

export function SubjectPicker({
  journal,
  info,
  change,
  disabled,
}: {
  journal: Journal
  info: SessionInfo
  change: (info: SessionInfo) => void
  disabled: boolean
}) {
  const current = journal.subjects.find((s) => s.id === info.subjectId)
  const options = journal.subjects.filter((s) => s.state === 'active')
  const optionText = (s: Subject) => s.name + (s.kind === 'todo' ? ' · To-do' : ' · Activity')
  const recent = journal.sessions.find(
    (s) => s.mode === 'focus' && s.subjectId === current?.id && s.endedAt,
  )
  return (
    <fieldset className="session-info" disabled={disabled}>
      <div className="fields">
        <label>
          Subject
          <input
            list="subjects"
            value={current ? optionText(current) : (info.activity ?? '')}
            placeholder="General Study"
            onChange={(e) => {
              const value = e.target.value
              const match = options.find((s) => optionText(s) === value)
              change({ ...info, subjectId: match?.id, activity: match ? undefined : value })
            }}
          />
        </label>
        <datalist id="subjects">
          {options.map((s) => (
            <option key={s.id} value={optionText(s)} />
          ))}
        </datalist>
        <label>
          Session title
          <input value={info.title ?? ''} onChange={(e) => change({ ...info, title: e.target.value })} />
        </label>
      </div>
      <details>
        <summary>Notes and tags</summary>
        <div className="fields">
          <label>
            Notes
            <textarea
              value={info.notes ?? ''}
              onChange={(e) => change({ ...info, notes: e.target.value })}
            />
          </label>
          <label>
            Tags
            <input value={info.tags ?? ''} onChange={(e) => change({ ...info, tags: e.target.value })} />
          </label>
        </div>
      </details>
      {recent && (recent.title || recent.notes) && (
        <small>Last session · {[recent.title, recent.notes].filter(Boolean).join(' — ')}</small>
      )}
      {current && <Effort subject={current} journal={journal} />}
    </fieldset>
  )
}

type Props = { journal: Journal; refresh: () => void; onHistory: (id: number) => void }
export function Subjects({ journal, refresh, onHistory }: Props) {
  const [edit, setEdit] = useState<Subject>()
  const [name, setName] = useState('')
  const [estimate, setEstimate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const creationKey = useRef(crypto.randomUUID())
  function select(s?: Subject) {
    setEdit(s)
    setName(s?.name ?? '')
    setEstimate(s?.estimateMinutes?.toString() ?? '')
    setError('')
  }
  async function submit(s?: Subject, state?: string) {
    setBusy(true)
    setError('')
    try {
      const item = state ? s : edit
      await save(item ? 'subjects/' + item.id : 'subjects', item ? 'PUT' : 'POST', {
        name: state ? item?.name : name,
        estimateMinutes: state ? item?.estimateMinutes : estimate ? Number(estimate) : null,
        kind: item?.kind ?? 'todo',
        state: state ?? item?.state ?? 'active',
        creationKey: creationKey.current,
      })
      creationKey.current = crypto.randomUUID()
      select()
      refresh()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <h1>To-Dos</h1>
      <form
        className="panel fields"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <label>
          {edit?.kind === 'activity' ? 'Activity name' : 'To-do title'}
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {edit?.kind !== 'activity' && (
          <label>
            Estimated effort (minutes, optional)
            <input
              type="number"
              min="1"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </label>
        )}
        <button disabled={busy}>{edit ? 'Save changes' : 'Add to-do'}</button>
        {edit && (
          <button type="button" onClick={() => select()}>
            Cancel
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      {['Active to-dos', 'Completed to-dos', 'Activities'].map((heading, index) => (
        <section key={heading} className="panel">
          <h2>{heading}</h2>
          {journal.subjects
            .filter((s) =>
              index === 2
                ? s.kind === 'activity'
                : s.kind === 'todo' && s.state === (index ? 'completed' : 'active'),
            )
            .map((s) => (
              <div key={s.id} className="subject-row">
                <div>
                  <strong>{s.name}</strong>
                  <Effort subject={s} journal={journal} />
                </div>
                <div className="chips">
                  <button onClick={() => onHistory(s.id)}>Sessions</button>
                  <button onClick={() => select(s)}>Edit</button>
                  {s.kind === 'todo' && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => void submit(s, s.state === 'completed' ? 'active' : 'completed')}
                      >
                        {s.state === 'completed' ? 'Reopen' : 'Complete'}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (confirm('Archive this to-do and keep its history?'))
                            void submit(s, 'archived')
                        }}
                      >
                        Archive
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
        </section>
      ))}
    </>
  )
}
