# Focus engineering decisions

## Milestone 1

- Run Vite and the API on loopback ports 5173 and 5120. The client uses a relative health URL and Vite proxies API calls, so local development needs one browser origin and no CORS configuration.
- Apply EF migrations at startup for the single-user workflow. The initial migration establishes the baseline and migration history. Add domain tables with the milestones that introduce their behavior.
- Use the operating system's per-user local application data directory for SQLite. The absolute directory override supports isolated tests and demo instances using the same startup path.

## Milestone 2

- Store block boundaries and each running or paused interval as UTC Unix milliseconds. Compute elapsed time from intervals and cap the final interval at the original deadline. Preset changes affect future blocks.
- Use a SQLite transaction and an expected timer revision for every command. A retried or stale command receives a conflict so a second tab cannot repeat a transition against a newer block.
- While a page is open it checkpoints at least every four seconds when browser scheduling permits, and requests a transition at expiry. A late callback finishes the original block at its deadline and starts at most one successor at the observation time. This avoids inventing whole cycles during a suspension.
- Reopening after all pages closed pauses an active block at the last checkpoint. The gap earns no focus or pause time. An in-memory browser lock distinguishes an additional live tab from a fresh visit. After a lost API connection the client also reattaches conservatively. Detailed interruption review belongs to Milestone 3.
- Both auto-start preferences initially use ON to support the default repeating Pomodoro cycle. With repeat off, an automatic break ends the cycle. With repeat and automatic breaks both off, focus completion returns directly to idle.
- Accept durations from one second to 24 hours. Reset saves elapsed work as partial and returns to idle focus. Keep the ten most recently ended focus blocks in the dashboard table; earlier records and break blocks remain in SQLite.

## Milestones 3–5

- Each interval has one accounting category. A pause reason and a make-up flag are additional dimensions. A distracted pause contributes once to the timeline and can also be inspected in the pause total.
- Check-ins default to off. The active session keeps the interval selected at start. With check-ins enabled, running time begins unverified. An answer covers eligible running time through the response, or through the frozen cutoff during review. Mixed review assigns the reported off-task duration to the latest eligible time, skipping pauses. Stand-alone reports are limited to the latest contiguous run, and oversized reports are rejected.
- Recovery freezes at the last checkpoint. A previously unanswered check-in whose countdown since expired instead retains an unverified review ending at the original deadline. Choosing make-up starts a new set of intervals on the same physical session. No intervals are created while waiting for review or for the make-up decision.
- A subject has a stable ID and is either a to-do or an activity. Case-normalized activity names prevent duplicates. Archiving and completion keep historical links. The migration links Milestone 2 records to General Study and preserves their original running and paused intervals.
- Study Days persist until explicitly closed. New days record the browser's time zone and local starting date. Pre-existing completed sessions have calendar reports; their original logical Study Day is unknown. Calendar reports use consecutive local midnights (including daylight-saving changes), slice durations at report boundaries, assign planned time to the start date, and assign completion counts to the end date. Pause time and make-up focus are overlapping dimensions of the reported metrics, never additional timeline categories.
- Personal entries occupy previously uncovered past time only. A conflicting entry is rejected with an opportunity to select a different range. Calendar-day review notes are optional.

## Milestones 6–7

- Settle one immutable reward entry per saved focus session in the same SQLite transaction as completion. Initial pricing uses one base coin per 12 verified minutes. Fixed-point credit from short and partial sessions carries forward to the next whole coin. The source of credit is the classified focus intervals, including verified make-up.
- Meeting the effective target on a completed session of at least 25 verified minutes advances the Study Day bonus. The first five qualifying sessions earn bonuses of 0, 1, 1, 2, and 2 coins. The cap stays at 2 thereafter. Breaks and partials leave the count intact. Done for the Day closes that bonus group, including when its final review is resolved later. Existing sessions are credited once in chronological order on upgrade. Sessions with unknown logical days earn base credit.
- The backend reads SecondsPerCoin, MinimumBonusMinutes, and BonusCap from Focus:Rewards. These initial rates are tunable. Old ledger entries retain their recorded amounts. The catalog defines the initial plant prices of 1, 3, 5, and 8 coins. Each debit is also a purchase receipt with a unique client request ID and a unique permanent slot in the garden. The responsive bed renders slots in order.
- A starter preserves its original 120-second plan. Continuing adds only the difference to the full duration selected at start. Five more minutes explicitly adds 300 seconds to the target. Both choices reuse the session, subject, and intervals; history retains the original plan and shows the extension. The optional return-to-task cue uses the current running time and is bounded by the existing deadline.
- Audio is synthesized locally. Completion alerts use a foreground app message, a configurable bell, and an optional browser notification. The full-screen control uses the browser API with a viewport fallback. Playback and palette preferences live in SQLite.

## Milestone 8 stopwatch

- Use the existing SQLite timer blocks, interval categories, and transactional revision checks. A stopwatch runs until an explicit pause or stop, including while the app is closed. Only its active spans are measured. Paused gaps remain available for optional personal time entries.
- Save immediately on stop so leaving the category form cannot lose elapsed time. The default General Activity is resolved as a reusable activity. Clearing the category stores a null subject link.
