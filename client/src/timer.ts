import { useCallback, useEffect, useRef, useState } from 'react'

export type Preferences = {
  focusSeconds: number; breakSeconds: number; loop: boolean; autoBreak: boolean; autoFocus: boolean
}
export type Session = {
  id: number; startedAt: number; endedAt: number; status: string
  plannedSeconds: number; effectiveMs: number; pausedMs: number
}
type Snapshot = {
  revision: number; mode: 'focus' | 'break'; status: 'idle' | 'running' | 'paused'
  plannedSeconds: number; remainingMs: number; preferences: Preferences; history: Session[]
}
type Reading = Snapshot & { received: number }

async function read(): Promise<Snapshot> {
  const response = await fetch('/api/timer', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error()
  return response.json()
}

async function post(action: string, version: number, preferences?: Preferences): Promise<Snapshot> {
  const response = await fetch('/api/timer/' + action, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision: version, preferences }), signal: AbortSignal.timeout(8000),
  })
  if (response.status === 409) return read()
  if (!response.ok) throw new Error()
  return response.json()
}

export function useTimer() {
  const [timer, setTimer] = useState<Reading>()
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const current = useRef<Reading | undefined>(undefined)
  const pending = useRef<Promise<void> | null>(null)
  const mounted = useRef(false)
  const update = useCallback(async (action: string, preferences?: Preferences) => {
    const expected = current.current?.revision
    const interactive = !['sync', 'attach', 'observe'].includes(action)
    if (interactive) setBusy(true)
    // A button click may arrive while a background checkpoint is being written.
    // Queue it, retaining the revision of the controls the user actually saw.
    if (pending.current) {
      if (!interactive) return pending.current
      await pending.current
    }
    async function run() {
      try {
        const previous = current.current
        let next: Snapshot
        if (!previous) {
          next = await read()
          if (next.status === 'running' && action !== 'observe') next = await post('attach', next.revision)
        } else if (action === 'sync' && previous.status !== 'running') {
          next = await read()
        } else {
          next = await post(action, expected ?? previous.revision, preferences)
        }
        if (mounted.current) {
          const state = { ...next, received: performance.now() }
          current.current = state
          setTimer(state)
          setError(false)
        }
      } catch {
        if (mounted.current) {
          setError(true)
          current.current = undefined
        }
      } finally {
        pending.current = null
        if (mounted.current && interactive) setBusy(false)
      }
    }
    pending.current = run()
    await pending.current
  }, [])

  useEffect(() => {
    mounted.current = true
    let release: (() => void) | undefined
    const lifetime = new Promise<void>(resolve => { release = resolve })
    // A second live tab can observe the existing countdown. Only the first
    // page back after all tabs closed needs the conservative reattachment.
    async function connect() {
      if (!navigator.locks) return update('attach')
      await navigator.locks.request('focus-open-pages', { ifAvailable: true }, async lock => {
        await update(lock ? 'attach' : 'observe')
      })
      await navigator.locks.request('focus-open-pages', { mode: 'shared' }, () => lifetime)
    }
    void connect()
    return () => { mounted.current = false; release?.() }
  }, [update])

  useEffect(() => {
    let delay = 4000
    if (!error && timer?.status === 'running') {
      delay = Math.min(delay, Math.max(50, timer.received + timer.remainingMs - performance.now()))
    }
    const id = window.setTimeout(() => void update('sync'), delay)
    // Retry even if the server stays offline and React keeps the same error state.
    const retry = error ? window.setInterval(() => void update('sync'), 5000) : undefined
    return () => { clearTimeout(id); clearInterval(retry) }
  }, [timer, error, update])

  return { timer, busy, error, update }
}

export function duration(seconds: number) {
  return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' +
    (seconds % 60).toString().padStart(2, '0')
}
