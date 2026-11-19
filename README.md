# Focus

Focus is a local-first personal Pomodoro and productivity app. The React timer uses a local ASP.NET Core API and SQLite to store sessions, pauses, breaks, and preferences alongside the coin ledger and succulent garden. The [specification](docs/REQUIREMENTS.md) defines the product and milestone order.

## Run locally on macOS

Install the **.NET 10 SDK** and **Node.js 24 LTS** (including npm). Choose Arm64 for Apple silicon or x64 for an Intel Mac. Use the SDK installer and Node.js macOS installer from their official download pages. [Download .NET 10](https://dotnet.microsoft.com/download/dotnet/10.0) · [Download Node.js](https://nodejs.org/en/download)

In Terminal, check that `dotnet --list-sdks` lists a 10.0 SDK and `node --version` reports v24. Clone or open this repository, change into its root directory, and restore dependencies once:

```sh
dotnet restore
dotnet tool restore
npm ci --prefix client
```

Start the API in one terminal and Vite in a second terminal, both from the repository root:

```sh
./scripts/start-server
```

```sh
./scripts/start-client
```

Open **http://127.0.0.1:5173**. “Connected to the local API” confirms the browser reached the backend through Vite and the backend could open SQLite. The direct health URL is **http://127.0.0.1:5120/api/health**. Stop each process with Ctrl-C. Both services bind to loopback and run locally after dependencies have been restored.

## Use the timer

Start with General Study and the default 40-minute focus and 5-minute break, or select a preset or custom duration (minutes or mm:ss). Pause and resume preserve remaining time. Stop & save records a partial session. Reset also preserves elapsed work and returns to the idle focus timer.

Repeat, auto-start break, and auto-start next focus control transitions independently. Turn off repeat for a single cycle, or turn off both repeat and automatic breaks for focus only. Keep the app open for automatic transitions. After closing and reopening, resume from the last saved checkpoint. Recent sessions show local start and end times, the original plan, actual focus and pause time, and completion status.

## Stopwatch

Select **Stopwatch** on the Focus screen to log an activity without choosing a duration or a task. Pause excludes time until you resume. A running stopwatch continues from its saved start time across a browser or API restart. Stop and save records the measured intervals immediately under General Activity. You can then choose a to-do, an existing or new activity, or Uncategorized and optionally add notes. History also lets you change the category and notes later.

Use **+30s** and **+1m** while timing, while paused, or on a saved entry. The adjustment history shows when each addition was recorded. The combined total includes manual time. Statistics assigns manual additions to the entry’s start date and shows measured time separately. A stopwatch entry earns no coins and contributes no verified Pomodoro focus or estimated task effort.

## Attention, subjects, and reports

Choose an existing subject or type an activity name directly on Focus. Session titles, tags, and notes can be edited later in History. To-Dos supports optional effort estimates, completion, and archival. Its progress bar measures verified focus against the estimate.

Set a check-in interval to enable attention prompts. The countdown keeps running during a prompt. On expiry, review any unverified running time before continuing. Report distraction during a run or classify an explicit pause. When the original countdown falls short of its effective target, choose make-up or finish. On reopening, the interrupted-session panel offers resume or save partial.

Statistics opens on today's local calendar date. Choose another date, a logical Study Day, or a subject across all dates. Done for the Day saves the current block and closes the logical day. Any remaining unverified time can still be reviewed. Optional personal intervals and daily notes live in Statistics.

## Garden, quick start, and settings

A saved focus session earns base credit for its verified effective minutes. At the default rate, 12 verified minutes earn one coin. Partial credit carries forward. A capped bonus rewards consecutive qualifying completions within the same Study Day. The Garden shows your spendable balance, progress to the next coin, and shop prices. Buying a plant automatically places it in the bed. The artwork is bundled locally. [Asset sources and license](client/public/plants/SOURCES.md)

**Just start — 2 min** starts one session for the selected subject. Choose **Continue** to count the starter toward the full target. **Just five more minutes** extends an active countdown near its end. **Back to task** marks a brief re-entry period within the existing timer. The resume shortcut starts a fresh session using the most recent available subject and session details.

Use **Full screen** for the timer and essential controls. Exit with Escape or the on-screen control. Settings includes timer defaults, palettes, completion and check-in sounds, optional desktop notifications, ticking, and rainfall. Allow sound through a user interaction and grant desktop notification permission if desired. Keep the app open for alerts. The timer, reports, purchase flow, and garden use only the local API and bundled assets after setup.

### Timer alerts

In Settings or the Focus sound panel, choose spoken reminders at 10, 5, or 1 minute, session and break announcements, and an optional three-beep count-in before manual starts. The count-in can be canceled. Audio and voice have individual volume controls, including mute at 0%. Use **Test sound** and **Test voice** in your Mac browser. Speech requires a local system voice exposed by the browser. Keep the browser open, the device awake, and system audio enabled for audible alerts.

## Database

The server creates `focus.db` and applies pending EF Core migrations on startup. Its default location on macOS is `~/Library/Application Support/Focus/focus.db`. Set `Focus__DataDirectory` to an absolute directory path before starting the server to use a separate database, for example for a demo. Keep personal databases and backups outside the checkout.

### Back up and restore on macOS

Stop the API with Ctrl-C before copying the folder. Use the same data directory that the API uses. These commands create a private backup directory with a unique name and check the copied SQLite database:

```sh
umask 077
focus_data="${Focus__DataDirectory:-$HOME/Library/Application Support/Focus}"
focus_backup="$(mktemp -d "$HOME/Focus-backup.XXXXXXXX")"
cp -Rp "$focus_data/." "$focus_backup/"
sqlite3 "$focus_backup/focus.db" 'PRAGMA quick_check;'
```

Expect `ok`. Keep the entire backup folder, including any SQLite companion files. To inspect the backup safely, copy it to another private directory and run the API against that copy. To restore it as your primary database, stop the API, move the existing Focus data folder aside in Finder, then duplicate the saved folder at the original path with the original folder name. Restart the API and check History and Garden before removing any old copy.

For a portfolio demo, stop the primary API and launch a separate empty database:

```sh
Focus__DataDirectory="$(mktemp -d)" ./scripts/start-server
```

For a future schema change, edit the EF model and run these commands from the repository root:

```sh
dotnet ef migrations add <MigrationName> --project server/Focus.Api --output-dir Data/Migrations
dotnet ef database update --project server/Focus.Api
```

## Build and test

```sh
dotnet build --configuration Release
dotnet test --configuration Release --no-build
npm test --prefix client
npm run build --prefix client
```

To run the checked-in browser journeys, install Playwright Chromium once and then run:

```sh
(cd client && npx playwright install chromium)
npm run test:browser --prefix client
```

The browser suite serves the production frontend on port 5187 and an isolated API on port 5127. It uses a temporary database and a one-second earning rate to exercise a real purchase. The normal app uses the production rate. To run with an installed Chromium binary, set `FOCUS_TEST_CHROMIUM` to its executable path.

The xUnit integration tests exercise migrations, restart persistence, elapsed-time accuracy, partial saves, cycle settings, and concurrent commands against temporary SQLite files. The client build checks TypeScript and bundles the production assets. GitHub Actions runs these checks on macOS.

## Repository layout

- `client/` — React, TypeScript, Vite, and Tailwind CSS
- `server/Focus.Api/` — ASP.NET Core 10 Minimal API, EF Core context, and migrations
- `tests/Focus.Api.Tests/` — backend integration tests
- `docs/` — authoritative requirements and [engineering decisions](docs/DECISIONS.md)
- `scripts/` — local launch commands
