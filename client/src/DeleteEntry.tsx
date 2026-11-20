import { useState } from 'react'
import { save } from './journal'
export function DeleteEntry({ id, refresh }: { id: number; refresh: () => void }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          if (
            !confirm(
              'Discard this saved entry and remove its time from reports? Available reward credit from this entry will be reversed. Purchased plants stay in your garden.',
            )
          )
            return
          setBusy(true)
          try {
            await save('sessions/' + id, 'DELETE', undefined)
            refresh()
          } catch (e) {
            setError(String(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        Discard entry
      </button>
      {error && <small role="alert">{error}</small>}
    </>
  )
}
