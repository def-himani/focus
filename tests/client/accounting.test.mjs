import assert from 'node:assert/strict'
import test from 'node:test'
import { report } from '../../client/src/accounting.ts'
import { blank, calendarBounds, progress, timeRange } from '../../client/src/journal.ts'

const hour = 3600000
const subject = { id: 2, kind: 'todo', state: 'active', name: 'Book ABC', estimateMinutes: 900 }
const [start, midnight] = calendarBounds('2026-11-18')
const span = (start, end, category, pause = false, makeup = false) => ({
  start,
  end,
  category,
  pause,
  makeup,
})
const session = {
  id: 1,
  mode: 'focus',
  subjectId: 2,
  subject: subject.name,
  plannedSeconds: 4 * 3600,
  studyDayId: 7,
  startedAt: midnight - hour,
  endedAt: midnight + 2 * hour,
  status: 'completed',
  effectiveMs: 2 * hour,
  intervals: [
    span(midnight - hour, midnight + hour, 'focus'),
    span(midnight + hour, midnight + 2 * hour, 'off-task', true),
  ],
}
const journal = { ...blank, subjects: [subject], sessions: [session] }
test('calendar reports clip a physical session at local midnight; Study Day retains both pieces', () => {
  const first = report(journal, start, midnight)
  const second = report(journal, ...calendarBounds('2026-11-19'))
  assert.equal(first.totals.focus, hour)
  assert.equal(second.totals.focus, hour)
  assert.equal(first.planned, 4 * hour)
  assert.equal(second.planned, 0)
  assert.equal(first.completed, 0)
  assert.equal(second.completed, 1)
  const overnight = report(journal, session.startedAt, session.endedAt + 1, 0, 7)
  assert.equal(overnight.sessions.length, 1)
  assert.equal(overnight.bySubject.get(2), 2 * hour)
  assert.equal(overnight.paused, hour)
  assert.equal(overnight.totals['off-task'], hour)
  assert.equal(overnight.totals.pause, 0)
  assert.equal(overnight.pauses, 1)
  assert.equal(
    overnight.timeline.reduce((sum, i) => sum + i.end - i.start, 0),
    3 * hour + 1,
  )
})
test('DST calendar days use consecutive local midnights', () => {
  for (const [date, hours] of [
    ['2026-03-08', 23],
    ['2026-11-01', 25],
  ]) {
    const [a, b] = calendarBounds(date)
    assert.equal(b - a, hours * hour)
  }
})
test('estimated effort uses only attributed focus across dates and can exceed the estimate', () => {
  const rows = [
    session,
    { ...session, effectiveMs: 80 * 60000 },
    { ...session, subjectId: 3 },
    { ...session, mode: 'break' },
  ]
  assert.equal(progress(subject, rows).percent.toFixed(1), '22.2')
  assert.equal(progress({ ...subject, estimateMinutes: 100 }, rows).percent, 200)
})
test('personal, break, unverified and uncovered time partition the calendar', () => {
  const data = {
    ...blank,
    personal: [{ start: 0, end: 100, label: 'Sleep' }],
    sessions: [
      { ...session, mode: 'break', intervals: [span(100, 200, 'break')] },
      { ...session, intervals: [span(250, 300, 'unverified'), span(300, 350, 'focus', false, true)] },
    ],
  }
  const r = report(data, 0, 400)
  assert.equal(r.totals.personal, 100)
  assert.equal(r.totals.unaccounted, 100)
  assert.equal(r.totals.break, 100)
  assert.equal(r.totals.unverified, 50)
  assert.equal(r.makeup, 50)
  assert.equal(
    Object.values(r.totals).reduce((a, b) => a + b, 0),
    400,
  )
})

test('stopwatch time splits at midnight, leaves paused gaps and stays separate from focus totals', () => {
  const watch = {
    ...session,
    mode: 'stopwatch',
    plannedSeconds: 0,
    effectiveMs: 0,
    intervals: [
      span(midnight - hour, midnight + hour, 'stopwatch'),
      span(midnight + 1.5 * hour, midnight + 2 * hour, 'stopwatch'),
    ],
  }
  const data = { ...journal, sessions: [watch] }
  const first = report(data, start, midnight)
  const next = report(data, midnight, midnight + 2 * hour)
  assert.equal(first.totals.stopwatch, hour)
  assert.equal(next.totals.stopwatch, 1.5 * hour)
  assert.equal(next.totals.unaccounted, hour / 2)
  assert.equal(next.completed, 0)
  assert.equal(next.planned, 0)
  assert.equal(next.totals.focus, 0)
  assert.equal(next.bySubject.size, 0)
  assert.equal(report(data, start, midnight, 2).watches.length, 1)
  assert.equal(report(data, start, midnight, 3).watches.length, 0)
})

test('manual additions belong to the entry date, outside the measured timeline and effort totals', () => {
  const watch = {
    ...session,
    mode: 'stopwatch',
    plannedSeconds: 0,
    effectiveMs: 0,
    adjustments: [
      { seconds: 30, recordedAt: midnight + hour },
      { seconds: 60, recordedAt: midnight + 2 * hour },
    ],
    intervals: [span(midnight - hour, midnight + hour, 'stopwatch')],
  }
  const data = { ...journal, sessions: [watch] }
  const first = report(data, start, midnight)
  assert.equal(first.manualMs, 90000)
  assert.equal(first.totals.stopwatch, hour)
  assert.equal(first.totals.focus, 0)
  assert.equal(first.totals.unaccounted, midnight - start - hour)
  assert.equal(report(data, midnight, midnight + 2 * hour).manualMs, 0)
  assert.equal(progress(subject, [watch]).used, 0)
})

test('local time ranges include the end date only across midnight', () => {
  const before = midnight - 300000
  const after = midnight + 300000
  const endDate = new Date(after).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  assert.ok(timeRange(before, after).includes(endDate))
  assert.ok(!timeRange(after, after + 60000).includes(endDate))
  assert.ok(timeRange(after, null).endsWith('ongoing'))
})
