import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3100', viewport: { width: 360, height: 780 } },
  webServer: { command: 'npx next dev -p 3100', url: 'http://localhost:3100/hi/login', reuseExistingServer: true, timeout: 120_000 },
});
