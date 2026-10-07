import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const WEB_BASE_URL = 'http://localhost:3100';

const API_BASE_URL = 'http://localhost:3003';

const LOCAL_E2E_DATABASE_URL =
    'postgresql://typing_analytics:typing_analytics_e2e_local@localhost:5435/typing_analytics_e2e?schema=public';

const E2E_DATABASE_URL = process.env['E2E_DATABASE_URL'] ?? LOCAL_E2E_DATABASE_URL;

const REPOSITORY_ROOT = path.resolve(process.cwd(), '../..');

export default defineConfig({
    testDir: './e2e',

    fullyParallel: false,

    forbidOnly: Boolean(process.env['CI']),

    retries: process.env['CI'] ? 1 : 0,

    workers: 1,

    reporter: process.env['CI']
        ? [
              ['github'],
              [
                  'html',
                  {
                      open: 'never',
                  },
              ],
          ]
        : [
              ['list'],
              [
                  'html',
                  {
                      open: 'never',
                  },
              ],
          ],

    use: {
        baseURL: WEB_BASE_URL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
    ],

    webServer: [
        {
            name: 'api',
            cwd: REPOSITORY_ROOT,
            command: 'pnpm --filter @typing-analytics/api start',
            url: `${API_BASE_URL}/auth/me`,
            reuseExistingServer: false,
            timeout: 120_000,
            stdout: 'pipe',
            stderr: 'pipe',
            gracefulShutdown: {
                signal: 'SIGTERM',
                timeout: 1_000,
            },
            env: {
                NODE_ENV: 'test',
                DATABASE_URL: E2E_DATABASE_URL,
                PORT: '3003',
                WEB_ORIGIN: WEB_BASE_URL,
                JWT_ACCESS_SECRET: 'typing-analytics-e2e-only-access-secret-0123456789abcdef',
                JWT_ACCESS_TTL_SECONDS: '900',
                REFRESH_TOKEN_TTL_DAYS: '30',
            },
        },
        {
            name: 'web',
            cwd: REPOSITORY_ROOT,
            command:
                'pnpm --filter @typing-analytics/web exec next dev --hostname localhost --port 3100',
            url: WEB_BASE_URL,
            reuseExistingServer: false,
            timeout: 120_000,
            stdout: 'pipe',
            stderr: 'pipe',
            gracefulShutdown: {
                signal: 'SIGTERM',
                timeout: 1_000,
            },
            env: {
                NEXT_PUBLIC_API_BASE_URL: API_BASE_URL,
            },
        },
    ],
});
