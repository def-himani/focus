import { useCallback, useEffect, useRef, useState } from 'react'

import type { Session, SessionInfo } from './journal'
export type { Session } from './journal'
export type CommandData = {
  session?: SessionInfo
  offMs?: number
  reason?: string
  allOff?: boolean
  blockId?: number
}
export type Playback = {
  preStart: boolean
  speakTransitions: boolean
  remindTen: boolean
  remindFive: boolean
  remindOne: boolean
  alertVolume: number
  voiceVolume: number
  bell: boolean
  notifications: boolean
  ticking: boolean
  rain: boolean
  tickVolume: number
  rainVolume: number
  theme: string
}
export type Preferences = {
  playback: Playback
  focusSeconds: number
  breakSeconds: number
  loop: boolean
  autoBreak: boolean
  autoFocus: boolean
  checkSeconds: number
  promptSound: boolean
}
export type Snapshot = {
  nextCoinMs: number | null
  spoken: string | null
  freshCompletion: boolean
  cueAt: number
  completion: string | null
  earnedCoins: number
  starterTarget: number
  refocusMs: number
  targetSeconds: number
  nextReminderMs: number | null
  nextCheckMs: number | null
  stopwatch: Session | null
  active: Session | null
  selectedSubjectId: number
  phaseTargetMs: number
  recoveries: { id: number; title: string; startedAt: number }[]
  revision: number
  mode: 'focus' | 'break'
  status: 'idle' | 'running' | 'paused' | 'review' | 'choice' | 'starter-ended'
  plannedSeconds: number
  remainingMs: number
  preferences: Preferences
  history: Session[]
}
export type TimerEvent = {
  completion: string | null
  coins: number
  cueAt: number
  spoken: string | null
  freshCompletion: boolean
}
type Reading = Snapshot & { received: number }

async function read(): Promise<Snapshot> {
  const response = await fetch('/api/timer', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error()
  return response.json()
}

async function post(
  action: string,
  version: number,
  preferences?: Preferences,
  data?: CommandData,
): Promise<Snapshot> {
  const response = await fetch('/api/timer/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      revision: version,
      preferences,
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...data,
    }),
    signal: AbortSignal.timeout(8000),
  })
  if (response.status === 400) throw new RangeError(await response.json())
  if (response.status === 409) return read()
  if (!response.ok) throw new Error()
  return response.json()
}

export function useTimer() {
  const [timer, setTimer] = useState<Reading>()
  const [error, setError] = useState(false)
  const [message, setMessage] = useState('')
  const [event, setEvent] = useState<TimerEvent>()
  const [busy, setBusy] = useState(false)
  const current = useRef<Reading | undefined>(undefined)
  const pending = useRef<Promise<void> | null>(null)
  const mounted = useRef(false)
  const update = useCallback(
    async (action: string, preferences?: Preferences, data?: CommandData, startRevision?: number) => {
      const expected = startRevision ?? current.current?.revision
      const interactive = !['sync', 'attach', 'observe'].includes(action)
      if (interactive) {
        setBusy(true)
        setMessage('')
      }
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
            if (action !== 'observe') next = await post('attach', next.revision)
          } else if (action === 'sync' && previous.status !== 'running') {
            next = await read()
          } else {
            next = await post(action, expected ?? previous.revision, preferences, data)
          }
          if (mounted.current) {
            const state = { ...next, received: performance.now() }
            if (next.completion || next.earnedCoins || next.spoken)
              setEvent({
                completion: next.completion,
                coins: next.earnedCoins,
                spoken: next.spoken,
                cueAt: next.cueAt,
                freshCompletion: next.freshCompletion,
              })
            current.current = state
            setTimer(state)
            setError(false)
          }
        } catch (e) {
          if (e instanceof RangeError) {
            setMessage(e.message)
            return
          }
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
    },
    [],
  )

  useEffect(() => {
    mounted.current = true
    let release: (() => void) | undefined
    const lifetime = new Promise<void>((resolve) => {
      release = resolve
    })
    // A second live tab can observe the existing countdown. Only the first
    // page back after all tabs closed needs the conservative reattachment.
    async function connect() {
      if (!navigator.locks) return update('attach')
      await navigator.locks.request('focus-open-pages', { ifAvailable: true }, async (lock) => {
        await update(lock ? 'attach' : 'observe')
      })
      await navigator.locks.request('focus-open-pages', { mode: 'shared' }, () => lifetime)
    }
    void connect()
    return () => {
      mounted.current = false
      release?.()
    }
  }, [update])

  useEffect(() => {
    let delay = 4000
    if (!error && timer?.status === 'running') {
      delay = Math.min(
        delay,
        Math.max(
          50,
          timer.received +
            Math.min(
              timer.remainingMs,
              timer.nextCheckMs ?? Infinity,
              timer.nextReminderMs ?? Infinity,
            ) -
            performance.now(),
        ),
      )
    }
    const id = window.setTimeout(() => void update('sync'), delay)
    // Retry even if the server stays offline and React keeps the same error state.
    const retry = error ? window.setInterval(() => void update('sync'), 5000) : undefined
    return () => {
      clearTimeout(id)
      clearInterval(retry)
    }
  }, [timer, error, update])

  return { timer, busy, error, message, update, event }
}

export function duration(seconds: number) {
  return (
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    (seconds % 60).toString().padStart(2, '0')
  )
}
