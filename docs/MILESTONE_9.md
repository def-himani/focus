# Focus — Milestone 9: Activity Log, Clearer Time Tracking, and Usability

**Status:** Ready for implementation after Milestone 8 is merged.
**Product:** Focus (local-first personal time-accountability application).
**Scope:** New Activity Log view; clearer Study Day navigation; simpler visual reporting; improvements to timer, stopwatch, check-ins, History, and To-Dos.

> **Codex instructions:** Read `AGENTS.md` and `docs/REQUIREMENTS.md`, then this file in full. This file is an **addendum specifying Milestone 9**; it does not replace the established time-accounting rules, SQLite persistence requirements, or earlier milestones. If the repository has a newer approved requirements document, use it alongside this addendum. Implement the complete milestone, including backend, frontend, persistence changes where necessary, and tests. Preserve existing working features. Do not add unrelated features.

## 1. Product goal

Make Focus easier to use and easier to understand **at a glance**. Users should be able to see what they worked on during a personal Study Day, week, or month; recognize the balance of recorded focus and distraction; correct mistaken timer entries; and access detailed data only when they want it.

Keep the existing polished dark visual style. Improve layout, interaction, labeling, and information hierarchy rather than redesigning the entire application. Do not turn Focus into a calendar planner or project-management tool.

## 2. New navigation view: Activity Log

Add a seventh primary navigation view named **Activity Log**, alongside the existing Focus, To-Dos, History, Statistics, Garden, and Settings views.

Activity Log is a **read-only, automatically populated overview of recorded activity**, not a place that requires the user to submit timesheets or schedule work. Reuse existing persisted Pomodoro, stopwatch, To-Do, Activity, and Study Day data. Do not clone sessions or maintain a second, inconsistent source of totals.

### 2.1 Weekly view — default

- Default to a **Tempo Timesheets-inspired weekly view**.
- Show seven day columns and a compact timesheet with **To-Dos/Activities as rows** and days as columns; show actual recorded durations, not planned task estimates.
- Include concise day-level visualization (such as proportional stacked bars) for **recorded effective Pomodoro focus**, **explicitly recorded off-task time**, and **separate stopwatch activity time**.
- Show simple daily and weekly totals without requiring the user to read a detailed metrics table. Use short duration labels such as `1h 30m`.
- Clicking a populated cell or activity opens that day's linked sessions or a compact detail panel; allow drill-down to History/session details.
- Offer previous/next week navigation and a clear indication of the selected week.
- Empty days show a neutral empty state, not a failure, penalty, or assumed distraction.
- On small screens, use horizontal scrolling or an accessible responsive arrangement; retain usable labels.

### 2.2 Monthly view

- Provide a **Monthly** tab in the same Activity Log page, with a conventional calendar grid.
- Each date cell shows a small, legible **recorded time summary** and a simple color-coded indication of time distribution; avoid filling the calendar with many metrics or full session titles.
- Clicking a date reveals the corresponding To-Dos/Activities and their durations, with links to sessions.
- Allow movement between months. Do not add deadlines, planned tasks, or task scheduling to this calendar.
- For Study Days crossing midnight, consistently place the logical Study Day under its **start-date anchor** in weekly/monthly grouping. Make this clear through a small secondary date range where needed. Never duplicate one session or its total across Study Days. Calendar-date breakdowns remain available in detailed Statistics when desired.

### 2.3 Calm, minimal overview

- Prioritize **what was done**, **effective focus**, **recorded distraction**, and **other tracked activity**. Use meaningful color and a small number of concise labels.
- Support a compact **Focus %** and **Distracted %** summary for a Study Day/week where enough classified data exists:
  - `Focus % = verified effective Pomodoro focus / (verified effective Pomodoro focus + explicitly recorded off-task time) × 100`.
  - `Distracted % = explicitly recorded off-task time / the same denominator × 100`.
  - Count each time interval at most once. Off-task pause intervals already counted as off-task must not be added again.
  - **Exclude** unverified/unaccounted spans, ordinary pauses not classified as off-task, scheduled breaks, and unclassified stopwatch time from that denominator.
  - If the denominator is zero, show `—` or `Not enough recorded data`, **not** `0% focus`.
- These are percentages of **user-recorded classifications**, not objective measurements of attention, a moral rating, or a productivity score. No streak pressure or comparative ranking.
- Keep **Statistics** as the detailed analytical page and **History** as the precise session-record page. Avoid duplicating all their existing metadata in Activity Log.

## 3. Study Day as the primary way to browse work

### 3.1 Explicit, low-friction controls

- Show clear **Start Day** and **Done for the Day** actions near the main Focus workflow (or a compact, discoverable Study Day control).
- A Study Day is a **user-defined work period**, possibly starting in the afternoon and ending after midnight. **Do not end it automatically at midnight.**
- **Do not require Start Day** to begin a Pomodoro. If none is active, starting work can create the current Study Day automatically.
- If an earlier Study Day was left open, make it easy to **close it explicitly and start a new one**, without losing earlier records or assuming the hours in between were productive. Handle interruption/recovery and in-progress sessions safely.
- `Done for the Day` must preserve the existing reward-combo reset behavior without erasing coins or history.
- Stopwatch records remain valid without a Study Day; where applicable, make their grouping into daily views consistent and clearly labeled.

### 3.2 Human-readable labels

- Make **Study Day** the default basis for the new Activity Log and the simplified daily overview. Keep calendar-date reports available in detailed Statistics.
- Use intuitive relative labels where meaningful: **Today**, **Previous Study Day**, **2 Study Days Ago**, and so on. Do not label a Study Day `Yesterday` unless it actually corresponds to yesterday; skipped days must not produce misleading labels.
- When a Study Day spans midnight, show a **small secondary date range**, for example `Nov 18–19`; the primary label should remain readable.
- Prefer textual abbreviated months (`Nov`, `Jan`, `Jun`) instead of numeric month/date formats in visible UI.
- Hide years, timezone identifiers, and exact timestamps in ordinary overview layouts unless required to distinguish dates; keep them available in detailed views/tooltips when relevant.
- Preserve accurate timezone-aware instants and the original distinction between **Study Day** and **calendar date** internally.

## 4. Focus timer: cancel without saving

- Preserve **Pause/Resume** and **Stop & Save**.
- Add a separate, clearly labeled **Cancel & Discard** action for a mistaken or unwanted Pomodoro, even if it ran for some time.
- Confirm destructive cancellation where appropriate, especially if substantial time was recorded; make it clear that the user is **not** saving focus time.
- A canceled session must not contribute productive focus, task progress, session counts, or rewards. Maintain any minimal internal audit/state records necessary for data integrity without showing canceled attempts as normal productive sessions.
- Ensure controls remain available and understandable during full-screen mode and after timer state transitions.
- Navigation to other application views must remain possible while a timer is active; background timing/recovery must remain accurate.
- Prevent simultaneous active Pomodoro and stopwatch timing and accidental overlapping credited intervals. Switching modes should offer a clear resolution action rather than silently overwriting the current timer.

## 5. Stopwatch: simple optional correction after stopping

The stopwatch is a lightweight general activity logger, not a second Pomodoro verification workflow.

- Keep **Start, Pause, Resume, Stop**, with optional post-stop To-Do/Activity categorization (default **General Activity**) and notes.
- On stopping, show a **simple optional adjustment** before saving. If the user does nothing, save the measured active stopwatch duration as-is.
- Allow the user to classify an approximate portion as distracted, or otherwise reduce the recorded activity time. Example: stopwatch ran for **29 minutes**, user reports **5 minutes distracted** → save **24 minutes of activity + 5 minutes distracted** (29 minutes total). Validate that adjusted portions are nonnegative and do not exceed the recorded duration.
- Do **not** require repeated `−1m` taps or expose adjustment-ledger details. Prefer a simple `Distracted time (optional)` field or equivalent direct interaction. Remove or de-emphasize confusing `+30s` / `+1m` quick-add controls in favor of this simpler correction flow.
- Do not present an extra visible history such as `measured 29m, adjusted −5m` throughout the UI. Internally preserve the accurate start/end times and enough classification provenance for consistent reports.
- Stopwatch activity time is **not verified Pomodoro focus** and never earns focus coins. Show stopwatch-reported distracted time as explicitly user-classified, not as automatically detected distraction.
- Permit assignment/reassignment to an existing To-Do, Activity, newly created Activity, or Uncategorized after stopping and in History. Do not add stopwatch time to a To-Do's verified-focus estimate progress.
- Support stopwatch **full-screen mode**, with the usual controls and a functioning return to standard Focus view.
- Preserve correct accounting when stopwatch sessions are paused, span midnight, or are recovered after refresh.

## 6. Attention check-ins and completion review: prominent and understandable

### 6.1 During a Pomodoro

- Replace subtle text below the clock with a **clearly visible, accessible check-in overlay or dialog** that also works in full-screen mode.
- The question should be plain language, such as **Still focusing?**
- Make **Yes, I'm focused** a large, easy-to-hit confirmation target (not a tiny button the user must search for). Keep **I was distracted** visibly separate and easy to select; the latter opens the existing distraction-duration input.
- The overlay can have a gentle, screensaver-like visual cue, but **avoid persistent bouncing animation**, obscuring essential controls, or accidental confirmation from arbitrary clicks. Respect reduced-motion preferences.
- The underlying countdown **continues** while the prompt is shown. Do not stack prompts. Preserve all existing pending-check-in persistence and verification rules.
- Support mouse/touch and keyboard responses, with visible focus indicators and appropriate dialog accessibility.

### 6.2 At timer completion or on return

- When a time interval needs review, present a **clear, prominent review card/dialog**, not an unexplained request to classify `unaccounted` or `unverified` time.
- State **which interval** is being reviewed and **why**. Example: `You last confirmed focus at 4:10 PM. The timer ended at 4:30 PM. How did you spend those 20 minutes?`
- Actions: **Focused throughout**, **Distracted throughout**, or **Mixed**. For Mixed, request the duration or breakdown required by the existing ledger logic.
- Review only the actual unresolved interval, never time after the scheduled focus end or already classified intervals. Do not manufacture focus/distraction or duplicate rewards.
- Explain unfamiliar accounting terms in user-facing language; retain exact technical values in expandable details if useful.

## 7. To-Dos: compact card layout and simpler actions

- Replace oversized full-width task rows with a **responsive compact card layout**. On desktop, allocate approximately **three-quarters of the available width to Active To-Dos** (cards in two or more columns when space allows) and **one-quarter to Completed To-Dos** (compact cards). Use spacing that keeps cards readable, not cramped.
- On narrow screens, stack the areas or adapt the grid without truncating primary actions.
- Each card should show the task title and, if available, a small estimated-effort progress bar and concise time-spent label. Do not equate elapsed effort with percentage of task completion.
- Use a **pencil icon** for inline editing and a **checkbox/complete control** for completion. Give icons readable labels/tooltips and accessible names. Do not send the user unexpectedly to a form at the top when editing a card.
- Use a per-card **three-dot menu** for **Sessions**, **Archive**, and **Delete**. Completed cards should also support **Reopen**. Keep deletion separate from archiving and confirm destructive actions.
- Provide a discoverable **Archived** list/view and restoration where appropriate; clarify where archived tasks go.
- Allow deletion of mistakenly created To-Dos. If a To-Do has linked historical sessions, preserve the sessions and their historical meaning (for example, through a soft delete or retained reference) instead of cascading deletion.
- Keep **Activities** manageable below the task layout for now. Ensure users can add distinct reusable Activities (e.g., Art), rename them, and delete or archive mistakenly created Activities without destroying linked session history.
- Preserve the read-only upper-right **TO DO** overlay on Focus, including full-screen Pomodoro; it must remain unobtrusive and usable.

## 8. History and Statistics: understandable first, details on demand

### 8.1 Concise dates and durations

- Use local clock-time ranges such as `10:10 AM – 10:30 AM` instead of repeating complete date-time strings in every row.
- Use `Nov 19` and `Nov 18–19` as appropriate for compact date context. Avoid exposing `America/New_York`, full numeric dates, or the year in ordinary summary labels unless necessary.
- Show **hours and minutes** by default: e.g., `58 min`, `1h 29m`. Define consistent display rounding without changing stored exact durations. Very short nonzero durations must not misleadingly appear as `0m`; show `under 1 min` or equivalent.
- Keep original precise timestamps and seconds available on demand in details, tooltips, or exports if supported. Preserve all exact calculations.

### 8.2 Statistics hierarchy

- Retain the **Statistics** page for detailed metrics and filters; do not remove useful planned/effective/off-task/pause/unverified distinctions.
- Reduce repeated or overly prominent metric boxes and raw text in the default presentation. Group related metrics, use clear headings, concise values, and visual emphasis where appropriate.
- Add **a small number of familiar, labeled icons** where they improve recognition (for example, Pause, Focus, or Planned). **Do not replace every label with an icon** or add unexplained pictograms.
- Keep stopwatch totals separate from verified Pomodoro focus. Show recorded off-task and pauses separately without double counting.

### 8.3 Session-level visual timeline

- In History, make a session's main expanded detail an **interactive, chronologically ordered, duration-proportional timeline** of recorded **focus, off-task, paused, and unverified** intervals. Use a clear legend and readable time anchors.
- Hovering, clicking, or keyboard focusing on a segment reveals a short description, local clock-time range, and duration. The visualization must work without hover on touch screens.
- Keep exact check-ins, metadata, and technical interval records accessible through **collapsed secondary details**, rather than showing them as the primary content.
- Do not use a rising/falling line graph to claim an objectively measured `attention level`. Show actual user-recorded classifications.

### 8.4 To-Do and Activity drill-down

- Clicking a To-Do/Activity in Activity Log or Statistics should show its **linked sessions across dates**, its recorded durations, and an easy path to a specific session timeline in History.
- Clearly distinguish **verified Pomodoro focus**, **stopwatch activity**, and **explicitly classified distraction** in task/activity summaries.
- Retain existing History filters and detailed columns where useful, but simplify the first-screen presentation.

## 9. Deleting or correcting previously saved sessions

- Provide a clearly discoverable **Delete / Discard entry** action for an incorrect previously saved Pomodoro or stopwatch session, with confirmation.
- An entry removed from the user's active history must no longer inflate Statistics, Activity Log, To-Do progress, or session counts.
- Preserve the integrity of the time ledger and auditable reward/purchase history. Use a safe void/soft-delete/reversal strategy rather than silently erasing referenced ledger rows; never duplicate or corrupt rewards after retries, and do not delete previously purchased plants as a side effect.
- Allow ordinary session metadata (title, notes, category/To-Do link) to be edited without rewriting actual recorded timestamps. Stopwatch post-stop classification corrections must use explicit non-overlap validation.
- Document any limitations of reversing previously spent coin rewards and handle that case safely and explicitly.

## 10. Engineering constraints

1. **Existing stack:** ASP.NET Core 10, React/TypeScript/Vite/Tailwind, EF Core/SQLite; preserve local-first/offline behavior.
2. **Persistence:** User data and settings remain in backend SQLite, not browser local storage.
3. **Time accounting:** Preserve timestamp-based timing, non-overlapping intervals, conservative crash/recovery behavior, existing check-in and reward invariants. Study Day views must not falsify actual calendar dates.
4. **Data compatibility:** Introduce EF Core migrations when needed. Keep existing sessions, Study Days, To-Dos, Activities, coins, and plants accessible. Avoid destructive resets and hard-coded demo records in real data.
5. **Accessibility:** Keyboard-operable controls, labeled icons, dialog focus handling, visible focus states, reduced-motion support, responsive layouts, and colors paired with text/legends.
6. **UX restraint:** Keep Focus calm. No new deadlines, planners, streak penalties, rankings, compulsory forms, or forced time categorization.
7. **Implementation:** If a relevant behavior is already correct, reuse it rather than rebuilding it. Complete frontend, backend, API integration, and tests before declaring the milestone finished.

## 11. Acceptance checks

- **M9-01 — Weekly Activity Log:** With linked Pomodoro and stopwatch records across several dates, the weekly timesheet groups hours by To-Do/Activity and logical Study Day accurately; daily bars and totals agree with underlying records.
- **M9-02 — Monthly calendar:** A month view shows compact summaries; selecting a date opens recorded activities and links to sessions; no time is duplicated.
- **M9-03 — Focus percentage:** For 80 minutes verified Pomodoro focus and 20 minutes explicitly off-task, show **80% Focus / 20% Distracted**. Exclude unrelated pauses and unverified time; display `—` when no eligible time exists.
- **M9-04 — Overnight Study Day:** Start on Nov 18 at 3 PM, finish Nov 19 at 5 AM; the logical Study Day is a single navigable group labeled with a concise `Nov 18–19` range. Calendar-date statistics still split real intervals correctly.
- **M9-05 — Forgotten day closure:** A previously open Study Day can be explicitly closed before starting a new one, without phantom work credited between sessions.
- **M9-06 — Cancel running Pomodoro:** Start a 50-minute session, then choose Cancel & Discard after 20 minutes; it does not appear as productive focus or award coins. Stop & Save still records a partial session when selected.
- **M9-07 — Stopwatch correction:** Stop a 29-minute stopwatch, optionally report 5 distracted minutes; save **24 minutes activity + 5 minutes distraction**, or 29 minutes activity when no correction is entered. No focus rewards are granted.
- **M9-08 — Mode exclusivity:** Attempting to start stopwatch during a running Pomodoro (or vice versa) never creates overlapping active timers or silently deletes a session.
- **M9-09 — Full-screen:** Pomodoro and stopwatch have usable full-screen controls; the read-only To-Do overlay remains accessible in the upper-right without covering controls.
- **M9-10 — Check-in usability:** At the configured interval, a prominent `Still focusing?` overlay appears in regular/full-screen mode; large Yes and separate Distracted actions work while the countdown continues.
- **M9-11 — Clear final review:** An unanswered check-in causes a review that clearly identifies the unresolved interval; classifying Focused/Off-task/Mixed does not reclassify time after expiry or double-count known intervals.
- **M9-12 — Compact To-Dos:** Active and completed task cards use the responsive 75/25-style desktop arrangement; inline Edit, Complete/Reopen, and Sessions/Archive/Delete menu work. Archived items are findable and linked history is preserved.
- **M9-13 — History visualization:** Expanded session details show duration-proportional focus/off-task/pause/unverified segments; exact records remain available on demand.
- **M9-14 — Date/duration clarity:** Ordinary views show concise `Nov 19` dates, `10:10 AM – 10:30 AM` ranges, and hour/minute values; exact data remains unchanged in storage.
- **M9-15 — Session deletion:** Voiding an existing saved session updates History, Activity Log, Statistics, task aggregates, and rewards consistently without damaging purchased plants or historical ledgers.
- **M9-16 — Regression:** Existing Milestones 1–8 features, SQLite data, auto-loop safeguards, interrupted-session recovery, notification behavior, and garden purchasing continue to work.

## 12. Deliverables and completion criteria

1. Implement **all** Milestone 9 requirements in this document, not just the calendar UI.
2. Add/modify backend endpoints, persistence models, and migrations only where required.
3. Add automated unit/integration tests for Study Day grouping, time totals, manual corrections, cancellation/void behavior, and ledger integrity; add browser/UI tests for the major workflows where feasible.
4. Run backend and frontend builds, automated tests, and available browser tests. Fix failures before completion. **Do not claim unrun tests passed.**
5. Update README and relevant technical documentation for new views/controls, including any known browser or data-migration limitations.
6. Provide a concise report of completed features, actual test results, and any unmet acceptance checks. Present the implementation as a **pull request** against the appropriate base branch, if repository permissions allow.

**End of Milestone 9 specification.**
