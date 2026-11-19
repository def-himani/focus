export type Subject = {
  id: number
  name: string
  kind: 'activity' | 'todo'
  state: string
  estimateMinutes: number | null
}
export type SessionInfo = {
  subjectId?: number
  activity?: string
  title?: string
  notes?: string
  tags?: string
}
export type Interval = {
  start: number
  end: number
  category: string
  pause: boolean
  makeup: boolean
  reason: string
}
export type Session = {
  id: number
  mode: string
  startedAt: number
  endedAt: number | null
  lastObservedAt: number
  status: string
  subject: string
  subjectId: number
  studyDayId: number | null
  title: string
  notes: string
  tags: string
  plannedSeconds: number
  effectiveMs: number
  pausedMs: number
  offMs: number
  unverifiedMs: number
  countdownEnd: number | null
  makeupTargetMs: number
  interrupted: boolean
  pauseCount: number
  intervals: Interval[]
  checks: { scheduledAt: number; answeredAt: number | null; boundary: number; answer: string }[]
}
export type Day = { id: number; start: number; end: number | null; label: string; zone: string }
export type Personal = { id: string; start: number; end: number; label: string }
export type Journal = {
  notes: { date: string; note: string }[]
  subjects: Subject[]
  sessions: Session[]
  days: Day[]
  personal: Personal[]
}
export const blank: Journal = { notes: [], subjects: [], sessions: [], days: [], personal: [] }

export function elapsed(ms: number) {
  const seconds = Math.floor(ms / 1000)
  if (seconds >= 3600) return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm'
  return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's'
}
export function localDate(ms: number) {
  const d = new Date(ms)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}
export function calendarBounds(date: string): [number, number] {
  const start = new Date(date + 'T00:00:00')
  const next = new Date(start)
  next.setDate(next.getDate() + 1)
  return [+start, +next]
}
export function progress(subject: Subject, sessions: Session[]) {
  const used = sessions
    .filter((s) => s.mode === 'focus' && s.subjectId === subject.id)
    .reduce((a, s) => a + s.effectiveMs, 0)
  return {
    used,
    percent: subject.estimateMinutes ? (used / (subject.estimateMinutes * 60000)) * 100 : 0,
  }
}
export async function save(path: string, method: string, data: unknown) {
  const res = await fetch('/api/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.json().catch(() => 'Could not save changes.'))
  const channel = new BroadcastChannel('focus-journal')
  channel.postMessage('changed')
  channel.close()
}
