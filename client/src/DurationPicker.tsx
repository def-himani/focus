import { useState } from 'react'
import { duration } from './timer'

type Props = { label: string; presets: number[]; seconds: number; onChange: (seconds: number) => void }
export function DurationPicker({ label, presets, seconds, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [invalid, setInvalid] = useState(false)
  const custom = !presets.includes(seconds / 60)
  function apply(event: React.FormEvent) {
    event.preventDefault()
    const match = /^(\d{1,4})(?::([0-5]\d))?$/.exec(draft.trim())
    const value = match ? Number(match[1]) * 60 + Number(match[2] ?? 0) : 0
    if (value < 1 || value > 86400) {
      setInvalid(true)
      return
    }
    setEditing(false)
    onChange(value)
  }
  return (
    <fieldset>
      <legend>
        {label} {label === 'Check-in' ? 'interval' : 'duration'}
      </legend>
      <div className="chips">
        {presets.map((minutes) => (
          <button
            key={minutes}
            aria-pressed={seconds === minutes * 60}
            onClick={() => {
              setEditing(false)
              onChange(minutes * 60)
            }}
          >
            {minutes === 0 ? 'Off' : minutes + ' min'}
          </button>
        ))}
        <button
          aria-expanded={editing}
          aria-pressed={custom}
          onClick={() => {
            setDraft(duration(seconds))
            setInvalid(false)
            setEditing(!editing)
          }}
        >
          {custom ? duration(seconds) : 'Custom'}
        </button>
      </div>
      {editing && (
        <form className="custom" onSubmit={apply}>
          <label>
            {label} (mm:ss)
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button>Apply</button>
          {invalid && <small role="alert">Enter 00:01 to 1440:00.</small>}
        </form>
      )}
    </fieldset>
  )
}
