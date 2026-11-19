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
