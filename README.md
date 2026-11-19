# Focus

Focus is a local-first personal Pomodoro and productivity app. Milestone 1 provides a React connection screen, an ASP.NET Core health endpoint, and a migrated SQLite database. The [specification](docs/REQUIREMENTS.md) defines the product and milestone order.

## Run locally on macOS

Install the .NET 10 SDK and Node.js 24 LTS (including npm) for your Mac. From the repository root, restore the dependencies once:

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

## Database

The server creates `focus.db` and applies pending EF Core migrations on startup. Its default location on macOS is `~/Library/Application Support/Focus/focus.db`. Set `Focus__DataDirectory` to an absolute directory path before starting the server to use a separate database, for example for a demo. Keep personal databases and backups outside the checkout.

To back up, stop the server and copy the entire Focus data directory, including any SQLite companion files, to a private location. To restore, stop the server, move the existing directory aside and copy the saved directory back into place.

For a future schema change, edit the EF model and run these commands from the repository root:

```sh
dotnet ef migrations add <MigrationName> --project server/Focus.Api --output-dir Data/Migrations
dotnet ef database update --project server/Focus.Api
```

## Build and test

```sh
dotnet build --configuration Release
dotnet test --configuration Release --no-build
npm run build --prefix client
```

The xUnit integration test starts the API twice against a temporary SQLite file, calls the health endpoint, and checks the baseline migration. The client build checks TypeScript and bundles the production assets. GitHub Actions runs these checks on macOS.

## Repository layout

- `client/` — React, TypeScript, Vite, and Tailwind CSS
- `server/Focus.Api/` — ASP.NET Core 10 Minimal API, EF Core context, and migrations
- `tests/Focus.Api.Tests/` — backend integration tests
- `docs/` — authoritative requirements and [engineering decisions](docs/DECISIONS.md)
- `scripts/` — local launch commands
