import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activityDays,
  classified,
  dayName,
  dayRange,
  monday,
  shifted,
} from '../../client/src/activityLog.ts'
import { elapsed } from '../../client/src/journal.ts'

test('overnight activity anchors to the Study Day, including corrected stopwatch time exactly once', () => {
  const start = Date.parse('2026-11-18T15:00:00Z'),
    end = Date.parse('2026-11-19T05:00:00Z'),
    min = 60000
  const day = { id: 7, start, end, label: '2026-11-18', zone: 'UTC' }
  const session = { subjectId: 1, subject: 'Art', studyDayId: 7, startedAt: start, endedAt: end }
  const journal = {
    days: [day],
    sessions: [
      {
        ...session,
        id: 1,
        mode: 'focus',
        effectiveMs: 80 * min,
        offMs: 15 * min,
        pausedMs: 15 * min,
        unverifiedMs: 10 * min,
      },
      {
        ...session,
        id: 2,
        mode: 'stopwatch',
        startedAt: end - 29 * min,
        measuredMs: 29 * min,
        offMs: 5 * min,
      },
      { ...session, id: 3, mode: 'break', effectiveMs: 0, offMs: 0 },
    ],
  }
  const log = activityDays(journal)
  assert.equal(log.size, 1)
  const bucket = log.get(day.label)
  assert.deepEqual(bucket.totals, { focus: 80 * min, distracted: 20 * min, activity: 24 * min })
  assert.deepEqual(bucket.subjects.get(1), bucket.totals)
  assert.equal(bucket.sessions.length, 2)
  assert.deepEqual(classified(bucket.totals), { focus: 80, distracted: 20 })
  assert.equal(classified({ focus: 0, distracted: 0, activity: min }), null)
  assert.match(dayRange(day, end), /Nov 18.*19/)
  assert.equal(
    dayName(day, [{ ...day, start: end + 9 * 86400000 }, day], end + 9 * 86400000),
    'Previous Study Day',
  )
})
test('calendar navigation respects month and year boundaries and concise durations retain short work', () => {
  assert.equal(monday('2027-01-01'), '2026-12-28')
  assert.equal(shifted('2028-02-28', 1), '2028-02-29')
  assert.equal(elapsed(1), 'under 1 min')
  assert.equal(elapsed(89 * 60000 + 59000), '1h 29m')
})

test('different days, subjects and unlinked entries stay separate across week and month boundaries', () => {
  const min = 60000
  const start = +new Date(2027, 0, 31, 23, 30)
  const end = +new Date(2027, 1, 1, 2)
  const day = { id: 4, start, end, label: '2027-01-31', zone: 'UTC' }
  const entry = {
    startedAt: end - 5 * min,
    endedAt: end,
    measuredMs: 5 * min,
    offMs: 0,
    mode: 'stopwatch',
    subjectId: 9,
  }
  const days = activityDays({
    days: [day],
    sessions: [
      { ...entry, studyDayId: 4, subjectId: 7, mode: 'focus', effectiveMs: min },
      { ...entry, studyDayId: 4 },
      { ...entry, studyDayId: null, subjectId: 0, offMs: min },
      { ...entry, endedAt: null },
    ],
  })
  assert.deepEqual([...days.keys()], ['2027-01-31', '2027-02-01'])
  assert.deepEqual(days.get('2027-01-31').totals, { focus: min, distracted: 0, activity: 5 * min })
  assert.equal(days.get('2027-01-31').subjects.size, 2)
  assert.deepEqual(days.get('2027-02-01').subjects.get(0), {
    focus: 0,
    distracted: min,
    activity: 4 * min,
  })
})
