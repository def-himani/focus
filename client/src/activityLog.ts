import type { Day, Journal, Session } from './journal'

export type Recorded = { focus: number; distracted: number; activity: number }
export const emptyRecorded = (): Recorded => ({ focus: 0, distracted: 0, activity: 0 })
export const total = (r: Recorded) => r.focus + r.distracted + r.activity
export function accumulate(target: Recorded, other: Recorded) {
  target.focus += other.focus
  target.distracted += other.distracted
  target.activity += other.activity
}
export function classified(r: Recorded) {
  const denominator = r.focus + r.distracted
  if (!denominator) return null
  const focus = Math.round((100 * r.focus) / denominator)
  return { focus, distracted: 100 - focus }
}
export const dateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
export const asDate = (key: string) => new Date(key + 'T12:00:00')
export function shifted(key: string, days: number) {
  const d = asDate(key)
  d.setDate(d.getDate() + days)
  return dateKey(d)
}
export function monday(key: string) {
  return shifted(key, -((asDate(key).getDay() + 6) % 7))
}
export function shortDate(key: string) {
  return asDate(key).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: asDate(key).getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}
export function dateSpan(start: string, end: string) {
  if (start === end) return shortDate(start)
  if (start.slice(0, 7) === end.slice(0, 7) && asDate(start).getFullYear() === new Date().getFullYear())
    return shortDate(start) + '–' + asDate(end).getDate()
  return shortDate(start) + ' – ' + shortDate(end)
}
function zonedKey(ms: number, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ms)
  return ['year', 'month', 'day'].map((k) => parts.find((p) => p.type === k)!.value).join('-')
}
export function dayRange(day: Day, now: number) {
  return dateSpan(day.label, zonedKey(day.end ?? now, day.zone))
}
export function dayName(day: Day, days: Day[], now: number) {
  if (day.label === zonedKey(now, day.zone)) return 'Today'
  const newer = days.filter(
    (d) => d.start > day.start || (d.start === day.start && d.id > day.id),
  ).length
  if (!newer) return day.end ? 'Latest Study Day' : 'Current Study Day'
  return newer === 1 ? 'Previous Study Day' : newer + ' Study Days Ago'
}
export function recorded(s: Session): Recorded {
  return {
    focus: s.mode === 'focus' ? s.effectiveMs : 0,
    distracted: s.offMs,
    activity: s.mode === 'stopwatch' ? s.measuredMs - s.offMs : 0,
  }
}
export type LogDay = {
  key: string
  totals: Recorded
  sessions: Session[]
  subjects: Map<number, Recorded>
  days: Day[]
}
export function activityDays(journal: Journal) {
  const result = new Map<string, LogDay>()
  const studyDays = new Map(journal.days.map((d) => [d.id, d]))
  function bucket(key: string) {
    let item = result.get(key)
    if (!item) {
      item = { key, totals: emptyRecorded(), sessions: [], subjects: new Map(), days: [] }
      result.set(key, item)
    }
    return item
  }
  for (const day of journal.days) bucket(day.label).days.push(day)
  for (const s of journal.sessions) {
    if (!s.endedAt || !['focus', 'stopwatch'].includes(s.mode)) continue
    const d = bucket(studyDays.get(s.studyDayId ?? -1)?.label ?? dateKey(new Date(s.startedAt)))
    const r = recorded(s)
    d.sessions.push(s)
    const cell = d.subjects.get(s.subjectId) ?? emptyRecorded()
    accumulate(cell, r)
    d.subjects.set(s.subjectId, cell)
    accumulate(d.totals, r)
  }
  return result
}
