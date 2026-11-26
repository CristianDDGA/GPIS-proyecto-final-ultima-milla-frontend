import { defineConfig, devices } from '@playwright/test';

const isLiveBackend = process.env.PLAYWRIGHT_LIVE_BACKEND === '1';
const MOCK_API_PORT = 3100;
const E2E_WEB_PORT = isLiveBackend ? 5173 : 5174;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${E2E_WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      testMatch: /05-a11y-motion-responsive\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  ...(isLiveBackend
    ? {}
    : {
        webServer: [
          {
            command: 'node e2e/support/mock-millast-api.mjs',
            url: `http://127.0.0.1:${MOCK_API_PORT}/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 20_000,
            env: {
              ...process.env,
              MOCK_API_PORT: String(MOCK_API_PORT),
            },
          },
          {
            command: `npx vite --host 127.0.0.1 --port ${E2E_WEB_PORT} --strictPort`,
            url: `http://127.0.0.1:${E2E_WEB_PORT}`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
            env: {
              ...process.env,
              VITE_API_BASE_URL: `http://127.0.0.1:${MOCK_API_PORT}`,
              VITE_GOOGLE_CLIENT_ID: 'playwright-test-client.apps.googleusercontent.com',
            },
          },
        ],
      }),
});
