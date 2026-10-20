import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

const E2E_API_URL = 'http://localhost:3003';

test.use({
    trace: 'off',
    screenshot: 'off',
    video: 'off',
});

interface TestAccount {
    readonly email: string;
    readonly password: string;
}

interface CompletedSession {
    readonly id: string;
    readonly target: string;
}

function createTestAccount(): TestAccount {
    return {
        email: `journey-${randomUUID()}@example.com`,
        password: 'correct-horse-battery-staple',
    };
}

async function registerAccount(page: Page, account: TestAccount): Promise<void> {
    await page.goto('/register');

    await page.getByLabel('Email', { exact: true }).fill(account.email);

    await page.getByLabel('Password', { exact: true }).fill(account.password);

    const registrationResponsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/auth/register' &&
            response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: 'Create account' }).click();

    const response = await registrationResponsePromise;

    expect(response.ok()).toBe(true);

    await expect(
        page.getByRole('button', {
            name: /^Account menu\b/u,
        }),
    ).toBeVisible();

    await expect(page.getByTestId('session-mode')).toHaveText('authenticated');

    await expect(page.getByTestId('typing-surface')).toBeVisible();
}

async function logoutAccount(page: Page): Promise<void> {
    await page
        .getByRole('button', {
            name: /^Account menu\b/u,
        })
        .click();

    await page.getByRole('button', { name: 'sign out' }).click();

    await expect(page.getByRole('link', { name: 'sign in' })).toBeVisible();
}

async function loginAccount(page: Page, account: TestAccount): Promise<void> {
    await page.goto('/login');

    await page.getByLabel('Email', { exact: true }).fill(account.email);

    await page.getByLabel('Password', { exact: true }).fill(account.password);

    const loginResponsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/auth/login' &&
            response.request().method() === 'POST',
    );

    await page.getByRole('button', { name: 'Sign in' }).click();

    const response = await loginResponsePromise;

    expect(response.ok()).toBe(true);

    await expect(
        page.getByRole('button', {
            name: /^Account menu\b/u,
        }),
    ).toBeVisible();

    await expect(page.getByTestId('typing-surface')).toBeVisible();
}

async function completeTypingSession(page: Page): Promise<CompletedSession> {
    const surface = page.getByTestId('typing-surface');

    await expect(surface).toBeVisible({
        timeout: 30_000,
    });

    const target = await page.getByTestId('typing-text').textContent();

    if (target === null || target.length === 0) {
        throw new Error('The application did not provide a typing target');
    }

    const completionResponsePromise = page.waitForResponse(
        (response) => {
            const url = new URL(response.url());

            return (
                url.origin === E2E_API_URL &&
                /^\/typing-sessions\/[^/]+\/complete$/u.test(url.pathname) &&
                response.request().method() === 'POST'
            );
        },
        { timeout: 90_000 },
    );

    await surface.pressSequentially(target, {
        delay: 2,
    });

    const response = await completionResponsePromise;

    expect(response.status()).toBe(200);

    const sessionId = new URL(response.url()).pathname.match(
        /^\/typing-sessions\/([^/]+)\/complete$/u,
    )?.[1];

    if (sessionId === undefined) {
        throw new Error('The completed session ID was not available');
    }

    await expect(page.getByTestId('typing-results')).toBeVisible();

    await expect(page.getByText('session saved', { exact: true })).toBeVisible();

    await expect(page.getByTestId('result-wpm')).toBeVisible();

    await expect(page.getByTestId('persistence-status')).toHaveText('completed');

    return {
        id: sessionId,
        target,
    };
}

async function restartTypingSession(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Restart test' }).click();

    await expect(page.getByTestId('typing-surface')).toBeVisible({ timeout: 30_000 });
}

async function openHistoryDetail(page: Page, sessionId: string): Promise<void> {
    await page.goto('/history');

    await expect(page.getByTestId(`history-item-${sessionId}`)).toBeVisible();

    await page
        .getByRole('link', {
            name: `Open session ${sessionId}`,
        })
        .click();

    await expect(page).toHaveURL((url) => url.pathname === `/history/${sessionId}`);

    await expect(page.getByTestId('history-detail')).toBeVisible();
}

async function expectBehavioralReady(page: Page): Promise<void> {
    const chart = page.getByTestId('temporal-performance-chart');

    const pending = page.getByTestId('history-behavioral-pending');

    const checkAgain = page.getByRole('button', {
        name: 'Check again',
        exact: true,
    });

    await expect
        .poll(
            async () => {
                if (await chart.isVisible()) {
                    return true;
                }

                if (await pending.isVisible()) {
                    await checkAgain.click();
                }

                return false;
            },
            {
                message: 'Behavioral Analytics did not reach READY',
                intervals: [1_000, 2_000],
                timeout: 45_000,
            },
        )
        .toBe(true);

    await expect(chart).toBeVisible();
}

test.describe('Critical application journeys', () => {
    test('Flow B: multiple sessions feed historical and behavioral analytics', async ({ page }) => {
        test.setTimeout(180_000);

        const account = createTestAccount();

        await test.step('Authenticate the test user', async () => {
            await registerAccount(page, account);
            await logoutAccount(page);
            await loginAccount(page, account);
        });

        const firstSession = await test.step('Complete the first session', async () =>
            completeTypingSession(page));

        const secondSession = await test.step('Complete a second session', async () => {
            await restartTypingSession(page);

            return completeTypingSession(page);
        });

        expect(secondSession.id).not.toBe(firstSession.id);

        await test.step('Verify dashboard aggregation', async () => {
            await page.goto('/dashboard');

            await expect(
                page.getByRole('heading', {
                    name: 'Historical performance',
                }),
            ).toBeVisible();

            await expect(page.getByTestId('dashboard-data')).toBeVisible();

            await expect(page.getByTestId('dashboard-session-count')).toHaveText('2');

            await expect(page.getByTestId('dashboard-history-row')).toHaveCount(2);

            await expect(page.getByTestId('dashboard-recent-wpm')).toBeVisible();

            await expect(page.getByTestId('dashboard-recent-accuracy')).toBeVisible();
        });

        await test.step('Verify private history', async () => {
            await page.goto('/history');

            await expect(page.getByTestId(`history-item-${firstSession.id}`)).toBeVisible();

            await expect(page.getByTestId(`history-item-${secondSession.id}`)).toBeVisible();
        });

        await test.step('Verify persisted Behavioral Analytics', async () => {
            await openHistoryDetail(page, secondSession.id);

            await expect(page.getByTestId('history-detail-target')).toHaveText(
                secondSession.target,
            );

            await expectBehavioralReady(page);

            const chart = page.getByTestId('temporal-performance-chart');

            await expect(chart.locator('polyline')).toHaveCount(2);

            await expect(chart.getByTestId('chart-wpm-curve')).toHaveAttribute('points', /.+/u);

            await expect(chart.getByTestId('chart-raw-wpm-curve')).toHaveAttribute('points', /.+/u);

            await expect(page.getByTestId('chart-sample-count')).toContainText('temporal samples');

            await page.getByText('View temporal speed values').click();

            const table = page.getByRole('table', {
                name: 'Temporal WPM and Raw WPM measurements',
            });

            await expect(table).toBeVisible();

            expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);

            await expect(
                table.getByRole('columnheader', {
                    name: 'WPM',
                    exact: true,
                }),
            ).toBeVisible();

            await expect(
                table.getByRole('columnheader', {
                    name: 'Raw WPM',
                }),
            ).toBeVisible();
        });
    });

    test('Flow C: unauthenticated users cannot access private resources', async ({ page }) => {
        const protectedRoutes = [
            '/dashboard',
            '/history',
            '/history/00000000-0000-4000-8000-000000000001',
        ];

        await test.step('Reject protected browser routes', async () => {
            for (const route of protectedRoutes) {
                await page.goto(route);

                await expect(page).toHaveURL((url) => url.pathname === '/login');

                await expect(
                    page.getByRole('heading', {
                        name: 'Sign in',
                    }),
                ).toBeVisible();

                await expect(page.getByTestId('history-detail')).toHaveCount(0);

                await expect(page.getByTestId('dashboard-data')).toHaveCount(0);
            }
        });

        await test.step('Reject unauthenticated REST requests', async () => {
            const protectedResources = [
                '/auth/me',
                '/typing-sessions?page=1&pageSize=20',
                '/typing-sessions/00000000-0000-4000-8000-000000000001',
                '/analytics/overview?range=30d',
            ];

            for (const resource of protectedResources) {
                const response = await page.request.get(`${E2E_API_URL}${resource}`);

                expect(response.status(), `Unexpected status for ${resource}`).toBe(401);
            }
        });
    });

    test('Flow D: user A cannot access user B session', async ({ browser }) => {
        test.setTimeout(120_000);

        const contextB = await browser.newContext();
        const contextA = await browser.newContext();

        try {
            const pageB = await contextB.newPage();
            const pageA = await contextA.newPage();

            const accountB = createTestAccount();
            const accountA = createTestAccount();

            const ownedSession = await test.step('User B creates a private session', async () => {
                await registerAccount(pageB, accountB);

                return completeTypingSession(pageB);
            });

            await test.step('User B can read the owned session', async () => {
                await openHistoryDetail(pageB, ownedSession.id);

                await expect(pageB.getByTestId('history-detail-target')).toHaveText(
                    ownedSession.target,
                );
            });

            await test.step('User A has an independent account', async () => {
                await registerAccount(pageA, accountA);

                await pageA.goto('/history');

                await expect(pageA.getByTestId('history-empty')).toBeVisible();

                await expect(pageA.getByTestId(`history-item-${ownedSession.id}`)).toHaveCount(0);
            });

            await test.step('Reject cross-user session access', async () => {
                const detailResponsePromise = pageA.waitForResponse((response) => {
                    const url = new URL(response.url());

                    return (
                        url.origin === E2E_API_URL &&
                        url.pathname === `/typing-sessions/${ownedSession.id}` &&
                        response.request().method() === 'GET'
                    );
                });

                await pageA.goto(`/history/${ownedSession.id}`);

                const response = await detailResponsePromise;

                expect(response.status()).toBe(404);

                const responseBody = await response.text();

                expect(responseBody).not.toContain(ownedSession.target);

                await expect(pageA.getByTestId('history-detail-unavailable')).toBeVisible();

                await expect(pageA.getByTestId('history-detail')).toHaveCount(0);

                await expect(pageA.getByTestId('history-detail-target')).toHaveCount(0);

                await expect(pageA.getByTestId('temporal-performance-chart')).toHaveCount(0);
            });
        } finally {
            await contextA.close();
            await contextB.close();
        }
    });
});
