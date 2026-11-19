import { useState, useRef, useId, useEffect } from 'react'
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
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const matches = current
    ? options
    : options.filter((s) =>
        optionText(s)
          .toLowerCase()
          .includes((info.activity ?? '').trim().toLowerCase()),
      )
  const highlightedId = open ? matches[highlight]?.id : undefined
  useEffect(() => {
    if (highlightedId !== undefined)
      document.getElementById(listId + '-' + highlightedId)?.scrollIntoView({ block: 'nearest' })
  }, [highlightedId, listId])
  const choose = (s: Subject) => {
    change({ ...info, subjectId: s.id, activity: undefined })
    setOpen(false)
    setHighlight(-1)
  }
  const recent = journal.sessions.find(
    (s) => s.mode === 'focus' && s.subjectId === current?.id && s.endedAt,
  )
  return (
    <fieldset className="session-info" disabled={disabled}>
      <div className="fields">
        <div
          className="subject-picker"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
          }}
        >
          <label htmlFor={listId + '-input'}>Subject</label>
          <div className="subject-input">
            <input
              id={listId + '-input'}
              ref={input}
              role="combobox"
              aria-controls={listId}
              aria-expanded={open}
              aria-autocomplete="list"
              aria-activedescendant={
                open && matches[highlight] ? listId + '-' + matches[highlight].id : undefined
              }
              value={current ? optionText(current) : (info.activity ?? '')}
              placeholder="General Study"
              onFocus={(e) => {
                setOpen(true)
                e.target.select()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false)
                  return
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  setOpen(true)
                  setHighlight((i) =>
                    Math.max(0, Math.min(matches.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))),
                  )
                } else if (e.key === 'Enter' && open && matches[highlight]) {
                  e.preventDefault()
                  choose(matches[highlight])
                }
              }}
              onChange={(e) => {
                const value = e.target.value
                const match = options.find((s) => optionText(s) === value)
                change({ ...info, subjectId: match?.id, activity: match ? undefined : value })
                setOpen(!match)
                setHighlight(-1)
              }}
            />
            <button
              type="button"
              aria-label="Show subjects"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (open) setOpen(false)
                else {
                  input.current?.focus()
                  setOpen(true)
                }
              }}
            >
              ▾
            </button>
          </div>
          <div hidden={!open} role="listbox" id={listId} aria-label="Subjects">
            {matches.map((s, i) => (
              <div
                key={s.id}
                id={listId + '-' + s.id}
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
              >
                {optionText(s)}
              </div>
            ))}
            {!matches.length && <small>Start to use this activity.</small>}
          </div>
        </div>
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
function SubjectForm({
  item,
  kind,
  saved,
  cancel,
}: {
  item?: Subject
  kind: Subject['kind']
  saved: () => void
  cancel?: () => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [estimate, setEstimate] = useState(item?.estimateMinutes?.toString() ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const key = useRef(crypto.randomUUID())
  return (
    <form
      className="fields"
      aria-label={item ? 'Edit ' + item.name : 'Create ' + kind}
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await save(item ? 'subjects/' + item.id : 'subjects', item ? 'PUT' : 'POST', {
            kind,
            name,
            estimateMinutes: kind === 'todo' && estimate ? Number(estimate) : null,
            state: item?.state ?? 'active',
            creationKey: key.current,
          })
          key.current = crypto.randomUUID()
          setName('')
          setEstimate('')
          setError('')
          saved()
        } catch (err) {
          setError(String(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <label>
        {kind === 'todo' ? 'To-do title' : 'Activity name'}
        <input
          autoFocus={!!item}
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {kind === 'todo' && (
        <label>
          Estimated effort (minutes, optional)
          <input type="number" min="1" value={estimate} onChange={(e) => setEstimate(e.target.value)} />
        </label>
      )}
      <button disabled={busy}>
        {item ? 'Save changes' : kind === 'activity' ? 'Add activity' : 'Add to-do'}
      </button>
      {cancel && (
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      )}
      {error && <small role="alert">{error}</small>}
    </form>
  )
}

export function Subjects({ journal, refresh, onHistory }: Props) {
  const [editing, setEditing] = useState<number>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function setState(s: Subject, state: string) {
    setBusy(true)
    try {
      await save('subjects/' + s.id, 'PUT', { ...s, state })
      setError('')
      refresh()
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <h1>To-Dos</h1>
      <section className="panel">
        <SubjectForm kind="todo" saved={refresh} />
      </section>
      {error && <p role="alert">{error}</p>}
      {['Active to-dos', 'Completed to-dos', 'Activities'].map((heading, index) => (
        <section key={heading} className="panel">
          <h2>{heading}</h2>
          {index === 2 && <SubjectForm kind="activity" saved={refresh} />}
          {journal.subjects
            .filter((s) =>
              index === 2
                ? s.kind === 'activity'
                : s.kind === 'todo' && s.state === (index ? 'completed' : 'active'),
            )
            .map((s) => (
              <div className="subject-row" key={s.id}>
                {editing === s.id ? (
                  <SubjectForm
                    item={s}
                    kind={s.kind}
                    cancel={() => setEditing(undefined)}
                    saved={() => {
                      setEditing(undefined)
                      refresh()
                    }}
                  />
                ) : (
                  <>
                    <div>
                      <strong>{s.name}</strong>
                      <Effort subject={s} journal={journal} />
                    </div>
                    <div className="chips">
                      <button onClick={() => onHistory(s.id)}>Sessions</button>
                      <button onClick={() => setEditing(s.id)}>Edit</button>
                      {s.kind === 'todo' && (
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              void setState(s, s.state === 'completed' ? 'active' : 'completed')
                            }
                          >
                            {s.state === 'completed' ? 'Reopen' : 'Complete'}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              if (confirm('Archive this to-do and keep its history?'))
                                void setState(s, 'archived')
                            }}
                          >
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
        </section>
      ))}
    </>
  )
}
