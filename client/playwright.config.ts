import { defineConfig } from '@playwright/test'

if (!process.env.Focus__DataDirectory)
  throw new Error('Use npm run test:browser to create an isolated database.')

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5187',
    launchOptions: { executablePath: process.env.FOCUS_TEST_CHROMIUM || undefined },
  },
  webServer: [
    {
      command:
        'dotnet run --project ../server/Focus.Api -c Release --no-launch-profile -- --urls http://127.0.0.1:5127',
      url: 'http://127.0.0.1:5127/api/health',
      reuseExistingServer: false,
    },
    {
      command: 'node e2e/preview.mjs',
      url: 'http://127.0.0.1:5187',
      reuseExistingServer: false,
    },
  ],
})
