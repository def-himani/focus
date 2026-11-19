# Focus engineering decisions

## Milestone 1

- Run Vite and the API on loopback ports 5173 and 5120. The client uses a relative health URL and Vite proxies API calls, so local development needs one browser origin and no CORS configuration.
- Apply EF migrations at startup for the single-user workflow. The initial migration establishes the baseline and migration history. Add domain tables with the milestones that introduce their behavior.
- Use the operating system's per-user local application data directory for SQLite. The absolute directory override supports isolated tests and demo instances using the same startup path.
