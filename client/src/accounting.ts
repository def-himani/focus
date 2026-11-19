import type { Journal, Session } from './journal'

export type Span = { start: number; end: number; category: string; label: string }
export function report(journal: Journal, start: number, end: number, subjectId = 0, studyDayId = 0) {
  const timeline: Span[] = []
  const totals: Record<string, number> = {
    focus: 0,
    'off-task': 0,
    pause: 0,
    unverified: 0,
    break: 0,
    stopwatch: 0,
    personal: 0,
    unaccounted: 0,
  }
  let planned = 0,
    pauses = 0,
    paused = 0,
    makeup = 0,
    completed = 0,
    partial = 0
  const bySubject = new Map<number, number>()
  const sessions: Session[] = []
  const watches: Session[] = []
  for (const s of journal.sessions) {
    if (
      (studyDayId && s.studyDayId !== studyDayId) ||
      (subjectId && (s.subjectId !== subjectId || s.mode === 'break'))
    )
      continue
    const startsInside = s.startedAt >= start && s.startedAt < end
    const endsInside =
      s.endedAt != null &&
      s.endedAt >= start &&
      (s.endedAt < end || (Boolean(studyDayId) && s.endedAt === end))
    let intersects = false
    for (const i of s.intervals) {
      const a = Math.max(start, i.start),
        b = Math.min(end, i.end)
      if (b <= a) continue
      intersects = true
      const ms = b - a
      totals[i.category] += ms
      if (i.pause) {
        paused += ms
        if (i.start >= start) pauses++
      }
      if (i.category === 'focus') {
        bySubject.set(s.subjectId, (bySubject.get(s.subjectId) ?? 0) + ms)
        if (i.makeup) makeup += ms
      }
      timeline.push({
        start: a,
        end: b,
        category: i.category,
        label: s.mode === 'break' ? 'Scheduled break' : s.subject,
      })
    }
    if (s.mode === 'stopwatch' && s.endedAt && (startsInside || endsInside || intersects))
      watches.push(s)
    if (s.mode !== 'focus') continue
    if (startsInside) planned += s.plannedSeconds * 1000
    if (endsInside && s.status === 'completed') completed++
    if (endsInside && s.status === 'partial') partial++
    if (startsInside || endsInside || intersects) sessions.push(s)
  }
  if (!subjectId)
    for (const i of journal.personal) {
      const a = Math.max(i.start, start),
        b = Math.min(i.end, end)
      if (b > a) {
        timeline.push({ start: a, end: b, category: 'personal', label: i.label })
        totals.personal += b - a
      }
    }
  timeline.sort((a, b) => a.start - b.start)
  const filled: Span[] = []
  let cursor = start
  function gap(until: number) {
    if (!subjectId && until > cursor) {
      filled.push({ start: cursor, end: until, category: 'unaccounted', label: 'Unaccounted' })
      totals.unaccounted += until - cursor
    }
  }
  for (const span of timeline) {
    gap(span.start)
    filled.push(span)
    cursor = Math.max(cursor, span.end)
  }
  gap(end)
  return {
    timeline: filled,
    totals,
    planned,
    paused,
    pauses,
    makeup,
    completed,
    partial,
    watches,
    bySubject,
    sessions,
  }
}
