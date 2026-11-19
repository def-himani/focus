# Focus — Product Requirements & Engineering Specification

**Product name:** Focus  
**Document status:** Authoritative requirements for implementation  
**Version:** 1.0  
**Prepared:** 2026-11-18  
**Audience:** Codex and any developer working on the project.

> **Source of truth:** Implement this specification. Preserve the name **Focus** everywhere (application title, solution, namespaces, documentation). A succulent garden is a feature of Focus. If an implementation detail is not defined here, use a simple, reversible solution and document it. Do not invent additional product features.

---

## 1. Product overview

**Focus** is a polished, personal, local-first Pomodoro and time-accountability web application. It helps one person:

1. Start a focus timer immediately, with or without a predefined task.
2. Record *planned focus*, *verified effective focus*, *off-task time*, *pauses*, and *unverified time* accurately and separately.
3. Maintain a simple, ever-visible list of outstanding to-dos without scheduling or organizational overhead.
4. Track focus sessions against either a finishable to-do or a reusable open-ended activity (e.g., Art).
5. Explore productivity history by date and by to-do/activity, including overnight study periods.
6. Earn positive rewards for real effective focus, then spend coins on succulents and plants in a small, separate garden.

**Philosophy:** Easy to begin, easy to return after an interruption, no guilt or punishment, no mandatory planning, and no fabricated productivity statistics. Make focus enjoyable while keeping the timer itself clean.

**Intended environment:** One user, primarily using a Mac, running a local web app at `localhost`. A public portfolio/demo version may be built later without exposing personal data.

---

## 2. Finalized technology and boundaries

| Layer | Required technology or behavior |
|---|---|
| Backend | **C# / ASP.NET Core 10** (LTS), REST API; prefer straightforward Minimal APIs and well-separated business logic |
| Frontend | **React + TypeScript + Vite** |
| Styling | **Tailwind CSS** plus targeted CSS/SVG effects as appropriate |
| Persistence | **SQLite** through **Entity Framework Core**, with database migrations |
| Analytics visualization | A lightweight established charting library, e.g. Chart.js, as needed |
| Garden graphics | Bundled, reusable licensed 2D artwork and simple CSS/SVG animations; no game engine required |
| Tests | xUnit for backend logic and integration tests; browser/UI tests where practical (e.g., Playwright) |
| Repository | Git/GitHub; a single repository with `client/`, `server/`, `tests/`, `docs/` |
| DevOps | Simple repeatable local build; add CI (GitHub Actions) and optional Docker packaging when useful |
| Deployment | Fully functional locally; no cloud account or hosted API required at runtime |

**Persistence rule:** All persistent user data—including settings, tasks, activities, sessions, timer recovery state, check-ins, ledger/coins, garden purchases, and garden positions—must be saved in SQLite via the backend. **Do not use `localStorage`, `sessionStorage`, or IndexedDB for application persistence.** Transient React memory state is fine. Do not commit the personal `.db` file to Git.

**Architectural restraint:** One React app, one ASP.NET Core backend, one SQLite database. Avoid microservices, authentication/accounts, Kubernetes, extra databases, Redux unless proven necessary, or hosted dependencies.

**Portfolio-readiness:** Use understandable code organization, API validation, idempotent mutations, automated tests for the time ledger, accessible controls, README/setup instructions, and clear separation between sample/demo data and private local data. The app itself must remain simple to use.

---

## 3. Navigation and app views

A single web application with **six views**, navigated without leaving the application:

| View | Purpose | Essential contents |
|---|---|---|
| **Focus** | Main study experience | Timer, preset controls, subject/activity selector, session title, active estimated-effort progress, stationary read-only to-do overlay, audio/loop controls, full-screen mode, recent history below the fold |
| **To-Dos** | Minimal to-do management | Add/edit/complete/delete tasks; optional effort estimate; progress and linked-session access; completed tasks |
| **History** | Explore exact session records | Detailed chronological/filterable session table, actual start/end clock times, editing of titles/tags/notes, interruption detail |
| **Statistics** | Analyze time honestly | Today's figures, previous days, calendar-day and Study Day breakdowns, time-accounting timeline, by-task and by-activity reports |
| **Garden** | Positive gamification | Coin balance, succulent shop, single garden canvas with automatically placed purchased plants |
| **Settings** | Configure behavior | Durations, check-ins, cycling, sound/notifications, optional themes, data protection/backups |

The UI should not feel like six disconnected sites. The default view is **Focus**. The garden is a **dedicated view**, not timer background art. The To-Dos overlay on Focus is not the management page.

---

## 4. Focus timer — functional requirements

### FOC-01 — Time selection

- Focus presets: **30, 40, 50, 60 minutes, Custom**; initial default **40 minutes**.
- Break presets: **5, 10 minutes, Custom**; initial default **5 minutes**.
- Custom durations may include minutes and seconds; validate positive reasonable values.
- Selecting presets while **idle** updates the displayed countdown immediately; changing a running session must not silently rewrite historical planned duration.
- Display large countdown, current mode (**FOCUS** / **BREAK** / **MAKE-UP**), and unobtrusive progress indicator.

### FOC-02 — Controls

- Start; pause; resume; reset; **stop early and save**; skip break; configurable repeat/loop toggle (default **ON**).
- Loop ON: `Focus → Break → Focus → Break → ...` after relevant review/transition conditions are satisfied.
- Loop OFF: support `Focus → Break → Stop` or `Focus → Stop` (focus-only mode).
- Automatic start of a break and automatic start of the next focus block are distinct preferences; never auto-start when attention review or recovery is unresolved.
- **Done for the Day** is an explicit user action, not automatic at midnight; it ends the current logical Study Day and resets the consecutive-session *bonus counter* (not accumulated coins or task progress).

### FOC-03 — Alerts and optional ambience

- **Essential:** A clear completion bell/chime, visible end notification, optional desktop notification (permission-dependent).
- **Optional / low priority:** Ticking and gentle rainfall sounds with individual toggles/volume; theme colors/solid background/gradient/palette presets; optional external music link. The app must not depend on YouTube or music embedding.
- Browser notification and audio permission limitations must be handled gracefully; do not promise alerts when the browser is fully closed.

### FOC-04 — Full-screen mode

- Provide a functional full-screen focus view with large timer and essential controls, accessible from the Focus page.
- Full-screen should not be interrupted by garden imagery. The to-do overlay may remain available without becoming a management control.
- Standard dashboard layout remains accessible without reloading or losing timer state.

### FOC-05 — Easy start and extra minutes

- Provide optional **“Just start — 2 min”** beside ordinary Start as a low-friction entry. If the user continues into a normal session, those verified minutes count **once** and remain associated with the same task/activity; never create duplicate credits.
- Optional **“Just five more minutes”** near an appropriate stopping point may show the *accurate* next task-progress or coin threshold, without pressure or penalties. It is an opt-in extension, not an automatic increase in the planned timer.
- Optional one-click **“Back to task — 2 min”** on returning from distraction can help restart; it must not add time to or double-count the running session.

---

## 5. Session identity, titles, and subject selection

### SUB-01 — Subject picker

At the top of Focus, provide a convenient searchable/editable selector with three choices:

1. An existing **To-Do** (finishable goal, e.g., `Complete Book ABC`).
2. An existing **Activity** (ongoing category, e.g., `Art`).
3. A **new spontaneous activity**, typed and usable immediately; persist it for reuse later.

If untouched, use **General Study** as the editable default. Selecting/creating a to-do is **never required** to start a Pomodoro. Do not mandate creating a task for an impromptu Art session.

### SUB-02 — Session title and notes

- Each focus session has its own optional editable **title** (e.g., `Chapter 3`, `Sketching`, `Python exercises`) and optional **notes/tags**.
- Task/activity identity and session title are separate: `Complete Book ABC → Chapter 1`, then `Complete Book ABC → Chapter 2` are two sessions for the same task.
- Show the most recent session title and note when returning to a subject, if available, as a passive resume cue.
- Session title, linked subject, note, and tags can be edited later without rewriting actual logged time.

### SUB-03 — Persistent identifiers

- To-dos and activities each have stable database IDs; aggregate sessions by ID, **not** mutable display name.
- Reusing `Art` tomorrow should suggest the same Activity; don't create duplicates from repeated entry or simple case differences.
- Renaming an activity or a to-do must preserve all its historical sessions.
- History can be relinked to a different existing subject if needed.

---

## 6. Time accounting — authoritative definitions

**All statistics and rewards must derive from one non-overlapping timeline of recorded intervals.** The application must never label unknown time as distraction or award focus credit for time it cannot verify.

| Metric | Definition / treatment |
|---|---|
| **Planned focus** | Duration initially selected for a Pomodoro, e.g., 30 minutes. It is a target, not a claim of actual work. |
| **Timer running time** | Time consumed by the original focus countdown, excluding explicitly paused periods. |
| **Verified effective focus** | Time actually attributed to working, including verified make-up periods, excluding off-task, unverified, and paused intervals. |
| **Off-task** | User-declared distraction intervals (e.g., Sudoku), including explicitly classified pauses. This is preserved even after make-up work. |
| **Pause time** | Explicit Pause → Resume wall-clock intervals, with optional reason: distraction / necessary interruption / rest / unknown. This is a recorded dimension, not automatically all “wasted.” |
| **Unverified** | Timer-running intervals whose on-task status cannot be confirmed, e.g., unanswered check-ins; no coins until reviewed. |
| **Scheduled break** | Normal 5/10/custom break periods; exclude from effective focus and from focus-session count. |
| **Unaccounted** | Calendar/Study Day time not covered by any known category. Do not automatically label this as off-task. |
| **Make-up focus** | Verified additional work voluntarily performed after the original timer finishes; linked to the original session. |

**Counting rules:**

- Every underlying wall-clock instant has at most one *time-accounting category*; pause count is additional metadata on pause intervals, not a second additive category.
- A pause classified as distraction contributes to off-task totals **once**, not once as pause and again as an independent overlapping distraction.
- Do not silently attribute unverified time to effective focus.
- **Normal attribution when check-ins are Off:** user-started, unpaused countdown time counts as self-reported effective focus unless reclassified as distraction or interrupted. “Verified” here means **accounted for by the user/workflow**, not objectively detected brain attention; this is not surveillance. When check-ins are enabled, answered prompts and explicit reviews resolve their relevant intervals; unanswered intervals remain unverified.
- Break time never increases study totals; optional Art and other non-study Activities can still earn verified focus time and coins without value judgments.
- Make-up is a distinct extension attached to one original Pomodoro; never erase its prior off-task intervals.
- Use timestamps and a ledger/interval model; avoid naive `setInterval`-based decrement as the source of truth.

### ACC-01 — Early completion

If the user planned **30 min** and finishes their task after **23 min**, they can click **Stop & Save**. Save **23 min of actual verified focus** as a **partial / stopped-early session**. **Do not record the unused seven minutes as off-task.** Preserve the originally planned 30-minute target separately.

### ACC-02 — Self-reported distraction

For a **30-minute running countdown** with **7 min reported off-task**, if all remaining time is verified focused:

- Original focus countdown finishes after 30 running minutes (not extended automatically).
- Initial effective focus = **23 min**; off-task = **7 min**.
- Show optional choice **“Make up 7 minutes”** or **“Finish session.”**
- If the user makes up a verified 7 min: final effective = **30 min**; off-task remains **7 min**; same original session; total non-paused elapsed focus/make-up time = **37 min**.
- If they decline: record **23 min** effective, **7 min** off-task, and completed timer; distinguish “countdown completed” from “effective target met.”
- Additional distraction or pauses during make-up must be logged honestly; the optional make-up is not a guarantee of target achievement.

### ACC-03 — Session status distinctions

At minimum distinguish: **running**, **paused**, **awaiting attention review**, **original countdown completed**, **make-up running**, **finished**, **stopped early (partial)**, and **interrupted/recovery needed**. A successful timer expiry is not the same as achieving the intended effective-focus target.

---

## 7. Attention check-ins and pauses

### ATN-01 — Configurable check-ins

- Configurable reminders every **5, 10, 20 minutes**, **Custom**, or **Off**. The user may want frequent 5-minute reminders.
- At the chosen interval during active focus, display a small **“Still studying?”** prompt: **Yes** / **No, I got distracted**. Optionally play a gentle chime.
- The Pomodoro countdown **continues** while the prompt is on screen; it is **not paused or extended**.
- No pile-up of multiple check-in popups. Keep one unresolved prompt at a time.
- **Yes** verifies the appropriate preceding time interval, never future time.
- **No** permits entry of approximate off-task minutes; reclassify eligible previously running minutes as off-task, never add extra elapsed time to the session.
- Support an independent **Report distraction** action, even when no scheduled check-in is open.

### ATN-02 — Missing responses and end-of-timer review

- Record scheduled prompt timestamp, response timestamp, and last verified timestamp in SQLite.
- If a prompt goes unanswered, the countdown still ends at its **original finish time**.
- **Block the next automatic focus/break cycle** until the user resolves the attention review; the app must not record infinite unattended sessions.
- The pending question/review remains available when the user returns, including after the timer has expired.
- Review covers the **time between last verified focus and the timer end**, not hours after the countdown was scheduled to finish.
- Example: 4:00–4:30 Pomodoro; 4:10 Yes confirmed; 4:20 unanswered; timer expires 4:30; user returns 6:00. Review **4:10–4:30 (20 minutes)**. **4:30–6:00 is not part of that Pomodoro** and may be unaccounted-for day time.
- Review permits **focused**, **off-task**, or **mixed** classification (e.g., “I continued until 4:15, then left”). Until resolved, time remains unverified and earns no verified-focus coins.
- Protect against double-counting when a late distraction report overlaps already verified time or a pause. Limit/reconcile reports and expose any ambiguity for user confirmation rather than silently editing time.

### ATN-03 — Explicit pause tracking

- On Pause, stop the focus countdown and record pause start; on Resume, record pause end and duration automatically.
- Show per-session pause count and total time away.
- Optionally prompt for classification **Off-task / Necessary interruption / Rest / Leave unclassified**. Do not force a reason every time.
- Pause time does **not** eat the remaining scheduled focus countdown. Classified off-task pauses still count in off-task analytics, without inflating running focus.
- A pause or tab switch must not by itself make a user “fail” a session. Merely changing browser tabs is not a Pause or Interruption event.

---

## 8. Interrupted sessions and recovery

### REC-01 — Crash, close, reload, and recovery list

- Persist focus session state, important events, remaining planned work, last reliably recorded timestamp, and pending reviews in **SQLite**.
- On reopening after an abandoned running session or crash, present an **Interrupted Sessions** review panel containing recoverable sessions.
- For each session, offer **Resume** (recover remaining work conservatively) and **Close & Save Partial**. Provide a **Close All** flow with confirmation if several are unresolved; do not delete historical work.
- Do not assume time while the app was closed was verified effective focus. Uncertainty must be reviewed or left unverified.
- Do not start another cycle until the interrupted session is resolved.
- Browser close events cannot be relied on for exact timing: use durable event records and conservative recovery, rather than claiming precise closure detection.
- Normal tab switching/backgrounding is expected; it is **not** automatically a crash or interruption. Countdown should calculate from timestamps and remain accurate despite browser throttling.

---

## 9. To-Dos — intentionally minimal

### TODO-01 — Basic task life cycle

- Dedicated To-Dos view supporting **create, rename/edit, mark complete, see completed, and delete/archive**.
- Only task title is required. Optionally add **estimated total effective effort** in minutes/hours (e.g., 15 hours for `Complete Book ABC`).
- To-dos stay active indefinitely until completed or removed. **No daily rollover action** or allocation to “today” / “tomorrow.”
- A due date, if relevant, may simply be part of the text title. The app must not introduce deadline fields, calendar reminders, or scheduling.
- Deleting/archiving a to-do must **not delete its linked Pomodoro history**; use safe archival/soft deletion or preserve historical reference metadata.

### TODO-02 — Estimated-time progress

- Accumulate verified effective focus across **all sessions** linked to that task, regardless of study date.
- For a 15-hour estimate and 3h20 effective focus, show `3h 20m / 15h = 22.2% of estimated effort used`.
- Show a pleasant progress bar in the To-Dos view and a compact, subdued version on Focus when the task is selected.
- The bar is **time spent against an estimate**, not percentage of the book actually read. It may exceed 100%; task is marked complete **only by user action**.
- A task can be worked on across weeks with any number of distinct session titles/notes.

### TODO-03 — Read-only floating overlay on Focus

- A fixed, aesthetically designed, semi-transparent panel in the **upper-right** labeled **`TO DO`**, ideally with its heading integrated into the panel border.
- Display **all active to-do titles**, one clean line per task. **No bullet symbols, checkboxes, toggles, or inline editing.**
- **No animated ticker, carousel, looping text, or moving list.** If many tasks exist, the *inside* of the panel may scroll while the panel stays in place.
- This panel exists to make responsibilities visible. Manage tasks only through the dedicated To-Dos view.

### TODO-04 — Explicit exclusions

Do **not** implement separate today/tomorrow plans, task drag-and-drop scheduling, structured deadlines, reminders, priorities, recurring tasks, nested subtasks, Kanban boards, or project-management workflows. Optional session titles (`Chapter 1`, `Chapter 2`) already cover fine-grained work logs.

---

## 10. Reusable Activities

### ACT-01 — Free-form activities

- An Activity is something tracked repeatedly without making it a finishable to-do, e.g., **Art**, Guitar Practice, General Study.
- A user can create an Activity implicitly by typing its name while starting a Pomodoro, with no extra form.
- Save and suggest past activities for later sessions; never force the activity into the To-Dos overlay.
- Example: `Art` → `Sketching` (40 min), `Painting` (40 min), `Shading` (40 min) on Day 1; choose `Art` again Day 2; statistics show **all Art time across days**.
- Allow rename without losing history, with reasonable normalized duplicate handling.
- Activities do not require time estimates or completion states.

---

## 11. History and statistics

### HIS-01 — Session history

- Show a concise **recent-session table below the timer when scrolling** on Focus; also provide a dedicated, fuller **History** view.
- Default columns: local start–end time, date/Study Day, subject (to-do/activity), session title, planned duration, verified effective time, off-task time, pause count or time, completion status.
- Breaks **do not** create productive-focus history rows and do not count as completed Pomodoros. Their durations remain available in the time-accounting model.
- Session detail expands to show check-in answers, distraction records, pause durations/reasons, make-up time, and notes/tags.
- Allow edit of descriptive metadata (title, tags, note, subject) without falsifying recorded timestamps/time categories; if time corrections are added, preserve an audit trail.

### STAT-01 — Date reports

- Statistics view opens with **today’s** focus metrics at the top; below, allow selecting a **prior date** for the same detailed breakdown.
- Daily metrics: planned minutes, verified effective minutes, off-task minutes, pause time and count, unverified minutes, scheduled break time, completed vs partial sessions, make-up focus, and focus-by-subject totals.
- Provide a clear timeline or chart indicating which parts of the day were focused, off-task, on break, personal time, or unaccounted-for.
- Trends across multiple days (weekly totals and attention patterns) may be shown without pressure-based streaks or punitive ratings.

### STAT-02 — To-do and Activity reports

- Ability to select a **to-do** and see all linked sessions across dates, total verified effective time, off-task time, pauses, titles/notes, and optional estimated-effort progress.
- Ability to select an **activity** and see the same historical breakdown without task completion/estimate features.
- Ability to select a **date** and see exactly which to-dos and activities were worked on that date, with their session records and totals.
- Task creation date does **not** determine analytical grouping; actual session timestamps do.

### STAT-03 — Optional 24-hour accounting

- Allow optional entry of wake/bedtime or study-day boundary information and optional time blocks such as meals, sleep, exercise, errands, rest, and other personal activities.
- App-generated focus, breaks, and classified interruptions populate known parts of the timeline automatically.
- Remaining uncovered spans are **Unaccounted**, **not** automatically “wasted.”
- Manual time entries must not overlap known intervals without an explicit conflict-resolution mechanism.
- Daily log/review note is optional; never mandatory for running a Pomodoro.

---

## 12. Overnight work and Study Day

### DAY-01 — Logical Study Day

- A **Study Day** is a user-controlled block of work, possibly spanning midnight. It starts when work begins (or when a new block is explicitly started) and ends only when the user chooses **Done for the Day**.
- Example: work begins **Nov 18 at 3:00 PM** and finishes **Nov 19 at 7:00 AM**. This may be one **Nov 18 Study Day** in Study Day statistics.
- Midnight must **not** automatically reset the combo reward bonus or break the logical Study Day.
- Keep accurate timezone-aware wall-clock timestamps. Store timestamps robustly (UTC instants with timezone context for display) and calculate conventional **calendar-day** totals by splitting intersecting intervals at local midnight **for reports only**, without cloning physical sessions.
- Support both *logical Study Day* and *calendar date* interpretations in analytics, clearly labeled so numbers are not misleading.
- **Done for the Day** resets only the current consecutive-session bonus counter; it does not erase accumulated coins, task progress, or session history.

---

## 13. Rewards and one-screen succulent garden

### GAME-01 — Principles

- **Positive rewards only.** No losing plants, coins, or history after a missed day. No streak penalties, artificial deadlines, shame messages, or forced challenges.
- Reward **verified effective focus**, not leaving a countdown running or creating tasks. Reward partial sessions proportionally where sensible.
- Successful focus completion produces a small **coin-earned notification** outside the main timer visuals. The Focus screen itself must contain **no garden/room background or live game graphics**.
- Longer or consecutive completed sessions may receive **modest, capped bonuses**. Normal breaks do not reset the combo. The combo resets at **Done for the Day**, not at midnight.
- Optional make-up work earns legitimate focus rewards and may earn a small one-off completion bonus, but it **never removes off-task history** and never triggers duplicate payout for the same session.
- Optional five-more-minutes prompt may indicate a real near-term coin or task-effort milestone. It must not misrepresent progress.

### GAME-02 — Single Garden view and purchases

- Provide **one** peaceful, attractive garden screen: a small shop of differently priced **succulents, cacti, small plants/flowers**, visible balance, and purchased collection.
- Buy a plant with coins → deduct balance atomically → place the plant **automatically** into a valid unused or pseudo-random garden position; update the garden visually and persist the placement.
- **No furniture/room builder, extra rooms, unlockable areas, leveling tree, planting chores, or drag-and-drop placement editor.**
- No user-supplied artwork is required. Use well-matched bundled open-license 2D assets and simple optional CSS/SVG animations; no game engine or online image API is necessary.
- Color variants of plants are optional **only if available inexpensively from the asset pack**; they are not required for initial implementation.

### GAME-03 — Coin logic and correctness

- The conversation established the desired pattern, **not exact final prices/formulas**: a 30-minute verified session might earn **2 coins**, a 40-minute session **3 coins**, and consecutive 40-minute sessions might yield **3, 4, 4, 5** via a capped combo bonus.
- Implement the reward engine behind configurable constants so its final rates can be tuned without database redesign. Document the initial formula chosen; do **not** represent example numbers as previously approved exact policy.
- Use a **transactional, append-only or auditable coin ledger** with a unique originating focus session/reward event identifier. Refresh/retry/resume must **never pay twice**.
- Don't create infinite coin farming from revisiting or editing an existing completed session. A purchase cannot spend more coins than available; purchase and placement are atomic.

### GAME-04 — Candidate free assets (license verification required)

Prefer consistent 2D art from one pack where possible:

- [Kenney Foliage Pack](https://kenney.nl/assets/foliage-pack)
- [Kenney Foliage Sprites](https://kenney.nl/assets/foliage-sprites)
- [OpenGameArt — CC0 Plant Clutter](https://opengameart.org/content/cc0-plant-clutter)
- [OpenGameArt — Flowers](https://opengameart.org/content/flowers)

Before bundling assets, **verify license terms and redistributability of the exact files**, retain notices if required, and avoid paid/watermarked/unlicensed graphics. If suitable art cannot be bundled in the cloud environment, build a graceful SVG/CSS placeholder garden and document how to swap in licensed assets later—do not block core functionality.

---

## 14. Settings, backup, accessibility, and reliability

### SET-01 — Settings

Persist focus/break presets and defaults, repeat/auto-start behavior, attention interval and prompt sound, completion bell/notifications, optional tick/rain sound, and optional simple theme/gradient presets in SQLite. Sound and themes are **secondary**; don't let them delay core timekeeping and history.

### DATA-01 — Backups and privacy

- No account, subscription, analytics trackers, ads, or cloud data dependency.
- All personal records persist locally in SQLite. Do not upload actual user activity to GitHub or the public portfolio.
- Back up the SQLite data in a safe local manner, with simple documented restore instructions. **CSV export is low priority and not a required UI feature.**
- Store program data in an appropriate writable local application data directory, not inside source-controlled files. The README must explain where it lives.

### UX-01 — Visual and functional quality

- Cohesive, contemporary, polished dark-first interface with strong timer legibility, readable translucent to-do panel, responsive layout and sensible spacing.
- Keep the Focus view visually calm. Reward feedback appears at completion; garden shopping is on its own view.
- Provide keyboard-accessible controls, visible focus styles, reasonable contrast, clear disabled states, and confirmation for destructive actions.
- Avoid requiring users to fill out forms, schedule tasks, classify every pause, or manage garden art just to use the timer.

### ENG-01 — Accuracy and resilience

- Use persisted event timestamps/intervals to derive actual timing, because background browser timers can be throttled.
- Design explicit, tested state transitions. Recover from refresh, crash, delayed check-in, midnight rollover, and database/API retries conservatively.
- Validate all API mutations. Apply database transactions for session completion and coin purchases; ensure unique reward events and avoid overlapping credited intervals.
- Simple documented setup for macOS: backend and frontend start scripts, EF Core migrations, seed/demo catalog if appropriate, and build/test commands.

---

## 15. User scenarios and acceptance tests

These are expected outcomes, not optional illustrative features.

| ID | Scenario | Expected behavior |
|---|---|---|
| AC-01 | Open Focus for the first time | Timer shows 40:00 focus, break 5 min, loop ON; **General Study** selected; Start works without creating a to-do. |
| AC-02 | Choose 30 focus / 5 break, loop ON | Focus 30 → Break 5 → repeats **only when no pending review/recovery and configured auto-start conditions permit**. |
| AC-03 | Choose loop OFF | Focus 30 → Break 5 → Stop, or focus-only 30 → Stop. |
| AC-04 | Study 23 of planned 30 minutes; Stop & Save | Save 23 min actual verified focus as partial, planned = 30; remaining 7 min **not** recorded as distraction. |
| AC-05 | Run 30 minutes, report 7 off-task, then make up 7 | 23 min initial effective, 7 off-task; after verified make-up 30 effective, 7 off-task, **one** session; no duplicate coins. |
| AC-06 | Yes check-in at 4:10, ignore 4:20, timer ends 4:30, return 6:00 | Focus timer stops at 4:30; no auto-chain; review 4:10–4:30 unverified until classified; 4:30–6:00 not counted in Pomodoro. |
| AC-07 | Pause 4:15–4:22, then resume | Save 7-minute pause and pause count; scheduled focus countdown has not advanced during pause. |
| AC-08 | Pause and classify same 7 minutes as distraction | Off-task = 7 min **not** 14; no overlapping time categories. |
| AC-09 | Start with Art (not a to-do), do sessions today and tomorrow | One reusable Art Activity; combined Art report includes all sessions without appearing in the to-do overlay. |
| AC-10 | Work on Book ABC across multiple dates | All sessions aggregate under one stable To-Do ID; chapter titles remain independent. |
| AC-11 | Book ABC estimate = 15 hours; verified focus = 3h20 | Display **22.2% of estimated effort used**, not 22.2% of the book completed. |
| AC-12 | Mark Book ABC complete or archive it | Remove from active overlay; preserve all previously linked sessions and task statistics. |
| AC-13 | Leave all to-dos unfinished overnight | They remain in the same persistent active list; no daily planning or carryover UI. |
| AC-14 | Close app mid-session, reopen | Show interrupted session with Resume / Close & Save Partial; no assumed verified focus while closed. |
| AC-15 | Start Nov 18 at 3 PM, finish Nov 19 at 7 AM, click Done | One logical Study Day and correctly split calendar-date reports; combo resets **on Done**, not at midnight. |
| AC-16 | Complete focus, receive coins, refresh | Coins persist and are not duplicated by refresh/retry. |
| AC-17 | Buy a succulent | Coins decrease once; plant is automatically placed once and remains visible after reopening. |
| AC-18 | Open Focus on a narrow window | Timer and actions remain usable; read-only to-dos remain visible or accessible without obscuring timer. |
| AC-19 | Use without internet after local setup | Timer, history, tasks, statistics, and garden still work without remote APIs. |
| AC-20 | User does not log sleep/meals | Pomodoro works normally; unknown timeline spans remain unaccounted rather than declared distractions. |

---

## 16. Suggested persistence model (implementation guidance)

This is a logical model, not a demand for exact table names. Use EF Core migrations and foreign keys to preserve referential integrity.

- `AppSettings` — timer/check-in/alert/theme preferences (single-user).
- `ToDo` — persistent ID, title, optional estimated minutes, completed/archived status.
- `Activity` — persistent ID, unique normalized name; `General Study` default.
- `StudyDay` — ID, start time, optional end time, `DoneForDay` state, logical labeling date.
- `FocusSession` — ID, Study Day ID, nullable ToDo/Activity ID, title, note, planned duration, status, time anchors, initial countdown and optional make-up links; session metadata.
- `SessionEvent` and/or `TimeInterval` — timestamps, interval category, verification/classification, pause/check-in relationships; enough provenance to reproduce statistics without overlap.
- `AttentionCheckIn` — scheduled time, last verification boundary, response time/type, resolved state.
- `DistractionReport` — linked eligible interval(s), user-entered minutes or boundaries, classification provenance.
- `BreakInterval` — intentional Pomodoro break start/end; no focus credit.
- `DailyActivityInterval` — optional sleep/meal/personal time, time-accounting boundaries.
- `CoinLedger` — reward/purchase transactions with unique event keys; immutable/auditable effects.
- `PlantCatalog` — plant type, local asset path, price.
- `GardenPlant` — owned plant, catalog reference, placed position/slot, purchase event.

**Invariant:** The same elapsed minute must never appear in multiple additive time categories. Metrics are derived from the authoritative interval classification and state history, not independently incremented counters that can drift.

---

## 17. Implementation sequence (build incrementally)

Complete each milestone, run its tests, and keep working features stable before starting the next.

1. **Foundation:** Repository structure; ASP.NET Core 10 API; React/TypeScript/Vite/Tailwind; EF Core SQLite/migrations; health endpoint; build and local-running instructions; tests scaffold; CI when practical. **Do not build the timer yet in this milestone.**
2. **Core timer and durable sessions:** Presets, controls, looping, accurate timestamps, break handling, persisted sessions, stop-early partials; recent history table.
3. **Time accountability:** Pauses, check-ins, No/distraction reports, unverified intervals, missing-answer review, make-up logic, state/recovery, no-overlap tests.
4. **Subjects and To-Dos:** Minimal CRUD; activities; session titles/notes/tags; stable linking; estimates/progress; read-only floating to-do overlay.
5. **History and Statistics:** Date/task/activity views, timeline, Study Day/overnight reports, optional personal-activity accounting.
6. **Rewards and Garden:** Idempotent coin rewards, capped combo, Done for the Day reset, succulent shop, one automatically arranged garden, local art assets.
7. **Polish:** Full-screen mode, attention accessibility, bell, optional rain/tick/themes, quick-start/re-entry options, automated browser tests, local backup/restore and safe portfolio/demo setup.

Milestone ordering is an engineering plan, **not permission to omit later agreed features**. Add a smoke test or acceptance test for each crucial behavior as it is implemented.

---

## 18. Explicit exclusions (do not reintroduce)

- No name other than **Focus** for the application.
- No Python/Flask backend, no dependence on cloud services for personal data.
- No built-in calendar, deadlines, urgency generators, rankings, penalties, streak-loss mechanics, or guilt messages.
- No today/tomorrow planner, scheduling, prioritized task boards, reminders, recurring tasks, nested subtasks, Kanban, or forced task organization.
- No garden graphics occupying the Pomodoro background; no furniture/room game; no additional rooms/unlockable land areas.
- No requirement to create a task before starting, and no daily logging requirement before studying.
- No moving or auto-rotating to-do list, bullet points, or checkboxes in the Focus overlay.
- No automatic addition of distracted minutes to the original timer; make-up is optional *after* original expiry.
- No assumption that unused planned time, unanswered prompts, closed-browser time, or unaccounted periods are distractions.
- No compulsory CSV exporting, AI coaching, tab surveillance, or medical/diagnostic scoring.

---

## 19. Remaining implementation choices — not settled product requirements

Codex should not turn the following into user-approved promises. Choose simple initial values **only when required to build a working feature**, record them centrally, and keep them configurable/reversible:

1. **Exact coin formula, combo multiplier/cap, and succulent prices.** The desired behavior and examples are settled, but exact rates are not.
2. **Exact auto-start defaults** for breaks and next focus sessions, distinct from loop ON; never override unresolved review/recovery.
3. **Check-in interval attribution** when a user reports more distracted minutes than the most recently unverified span, or responds late. Implement explicit eligible-time validation and an easy correction/review path; do not silently double-count.
4. **Interrupted-session last-known-time policy** when browser closure cannot be detected precisely. Be conservative and test outcomes.
5. **Precise quick-start transition** from 2-minute starter into selected full session; count time once, never silently extend an active countdown.
6. **Garden asset pack and visual arrangement** depending on actual licensed asset availability; simplest attractive consistent solution wins.
7. **How coin rewards for completed sessions are presented** when earned incrementally versus only displayed at the end; keep Focus minimally distracting and transaction logic accurate.
8. **Handling Study Days left open for multiple days:** present clear recovery/Done for the Day action without automatic midnight reset or losing timestamps.

These are legitimate implementation details. Do **not** re-open settled decisions such as project name, .NET stack, task simplicity, time-accounting categories, or reward-only philosophy.

---

## 20. Working agreement for Codex

1. Read **this entire file** before beginning a milestone. Treat it as the product source of truth.
2. Work **one milestone at a time**, with small verifiable changes; do not attempt the full application in the initial setup task.
3. Preserve app name **Focus** in namespaces, UI labels, README, package metadata, etc.
4. Do not omit required features for convenience, invent new user-facing features, or silently substitute different time-counting rules.
5. Make small, testable technical choices where specification leaves a choice; record them in `docs/DECISIONS.md` with reasoning. Escalate true requirement conflicts instead of guessing.
6. Build and test the affected components, report what was actually executed versus what was not available in the environment.
7. Keep all persistent data in backend SQLite, and keep local personal data out of commits.
8. Maintain this document as the permanent requirement reference; if the user revises a requirement, update it explicitly rather than appending contradictory conversation history.

**End of specification.**
