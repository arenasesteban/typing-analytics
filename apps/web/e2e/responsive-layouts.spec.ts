import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

const E2E_API_URL = 'http://localhost:3003';

const VIEWPORTS = [
    { label: 'narrow mobile', width: 320, height: 720 },
    { label: 'standard mobile', width: 375, height: 812 },
    { label: 'tablet', width: 768, height: 1024 },
    { label: 'desktop', width: 1280, height: 800 },
] as const;

test.use({
    trace: 'off',
    screenshot: 'off',
    video: 'off',
});

async function expectNoDocumentOverflow(page: Page): Promise<void> {
    const dimensions = await page.evaluate(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
    }));

    expect(
        dimensions.documentWidth,
        `Document overflow: ${JSON.stringify(dimensions)}`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);

    expect(
        dimensions.bodyWidth,
        `Body overflow: ${JSON.stringify(dimensions)}`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

async function registerE2EUser(page: Page): Promise<void> {
    await page.goto('/register');

    await page.getByLabel('Email', { exact: true }).fill(`responsive-${randomUUID()}@example.com`);

    await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple');

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
}

test.describe('Responsive application layouts', () => {
    test('public pages fit all supported viewports', async ({ page }) => {
        const routes = ['/', '/login', '/register'] as const;

        for (const route of routes) {
            await page.setViewportSize({
                width: 320,
                height: 720,
            });

            await page.goto(route);

            for (const viewport of VIEWPORTS) {
                await test.step(`${route} fits ${viewport.label}`, async () => {
                    await page.setViewportSize({
                        width: viewport.width,
                        height: viewport.height,
                    });

                    if (route === '/') {
                        await expect(page.getByTestId('typing-surface')).toBeVisible();
                    }

                    if (route === '/login') {
                        await expect(
                            page.getByRole('heading', {
                                name: 'Sign in',
                            }),
                        ).toBeVisible();

                        await expect(page.getByLabel('Email')).toBeVisible();

                        await expect(
                            page.getByLabel('Password', {
                                exact: true,
                            }),
                        ).toBeVisible();
                    }

                    if (route === '/register') {
                        await expect(
                            page.getByRole('heading', {
                                name: 'Create account',
                            }),
                        ).toBeVisible();

                        await expect(page.getByLabel('Email')).toBeVisible();
                    }

                    await expectNoDocumentOverflow(page);
                });
            }
        }
    });

    test('private empty states fit all supported viewports', async ({ page }) => {
        await page.setViewportSize({
            width: 320,
            height: 720,
        });

        await registerE2EUser(page);

        const accountButton = page.getByRole('button', {
            name: /^Account menu\b/u,
        });

        for (const viewport of VIEWPORTS) {
            await test.step(`account menu fits ${viewport.label}`, async () => {
                await page.setViewportSize({
                    width: viewport.width,
                    height: viewport.height,
                });

                await expectNoDocumentOverflow(page);

                await accountButton.click();

                const menu = page.locator('#account-menu');

                await expect(menu).toBeVisible();

                const bounds = await menu.boundingBox();

                expect(bounds).not.toBeNull();

                if (bounds !== null) {
                    expect(bounds.x).toBeGreaterThanOrEqual(-1);

                    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
                }

                await accountButton.click();

                await expect(menu).toBeHidden();
            });
        }

        await page.setViewportSize({
            width: 320,
            height: 720,
        });

        await page.goto('/dashboard');

        await expect(
            page.getByRole('heading', {
                name: 'Historical performance',
            }),
        ).toBeVisible();

        await expect(page.getByTestId('dashboard-empty')).toBeVisible();

        for (const viewport of VIEWPORTS) {
            await test.step(`empty dashboard fits ${viewport.label}`, async () => {
                await page.setViewportSize({
                    width: viewport.width,
                    height: viewport.height,
                });

                await expectNoDocumentOverflow(page);
            });
        }

        await page.setViewportSize({
            width: 320,
            height: 720,
        });

        await page.goto('/history');

        await expect(page.getByTestId('history-empty')).toBeVisible();

        for (const viewport of VIEWPORTS) {
            await test.step(`empty history fits ${viewport.label}`, async () => {
                await page.setViewportSize({
                    width: viewport.width,
                    height: viewport.height,
                });

                await expectNoDocumentOverflow(page);
            });
        }
    });

    test('completed session and historical data remain usable on narrow mobile', async ({
        page,
    }) => {
        test.setTimeout(180_000);

        await page.setViewportSize({
            width: 320,
            height: 720,
        });

        await registerE2EUser(page);

        const surface = page.getByTestId('typing-surface');

        await expect(surface).toBeVisible();

        const target = await page.getByTestId('typing-text').textContent();

        if (target === null || target.length === 0) {
            throw new Error('No generated typing target was available');
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
            delay: 20,
        });

        const completionResponse = await completionResponsePromise;

        expect(completionResponse.status()).toBe(200);

        const sessionId = new URL(completionResponse.url()).pathname.match(
            /^\/typing-sessions\/([^/]+)\/complete$/u,
        )?.[1];

        if (sessionId === undefined) {
            throw new Error('Completed session ID is unavailable');
        }

        await expect(page.getByTestId('typing-results')).toBeVisible();

        await expect(page.getByTestId('result-wpm')).toHaveText(/\d+/u);

        await expect(
            page.getByRole('button', {
                name: 'Restart test',
            }),
        ).toBeVisible();

        await expectNoDocumentOverflow(page);

        await test.step('Verify the populated dashboard', async () => {
            await page
                .getByRole('button', {
                    name: /^Account menu\b/u,
                })
                .click();

            await page
                .getByRole('link', {
                    name: 'dashboard',
                    exact: true,
                })
                .click();

            await expect(page).toHaveURL((url) => url.pathname === '/dashboard');

            await expect(page.getByTestId('dashboard-data')).toBeVisible();

            await expect(page.getByTestId('dashboard-session-count')).toHaveText('1');

            await expect(page.getByTestId('dashboard-history-row')).toHaveCount(1);

            await expectNoDocumentOverflow(page);

            const tableRegion = page.getByRole('region', {
                name: 'Historical values table',
            });

            await expect(tableRegion).toBeVisible();

            const dimensions = await tableRegion.evaluate((element) => ({
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
            }));

            expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

            await tableRegion.focus();

            await tableRegion.press('ArrowRight');

            await expect
                .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
                .toBeGreaterThan(0);
        });

        await test.step('Verify the populated history', async () => {
            await page
                .getByRole('button', {
                    name: /^Account menu\b/u,
                })
                .click();

            await page
                .getByRole('link', {
                    name: 'history',
                    exact: true,
                })
                .click();

            await expect(page).toHaveURL((url) => url.pathname === '/history');

            await expect(page.getByTestId(`history-item-${sessionId}`)).toBeVisible();

            await expectNoDocumentOverflow(page);
        });

        await test.step('Verify the session detail and temporal chart', async () => {
            await page
                .getByRole('link', {
                    name: `Open session ${sessionId}`,
                })
                .click();

            await expect(page.getByTestId('history-detail')).toBeVisible();

            await expect(page.getByTestId('history-detail-target')).toHaveText(target);

            await expectNoDocumentOverflow(page);

            const chart = page.getByTestId('temporal-performance-chart');

            const pending = page.getByTestId('history-behavioral-pending');

            await expect
                .poll(
                    async () => {
                        if (await chart.isVisible()) {
                            return true;
                        }

                        if (await pending.isVisible()) {
                            await page
                                .getByRole('button', {
                                    name: 'Check again',
                                })
                                .click();
                        }

                        return false;
                    },
                    {
                        intervals: [1_000, 2_000],
                        timeout: 45_000,
                    },
                )
                .toBe(true);

            await expect(chart).toBeVisible();

            await expectNoDocumentOverflow(page);

            await page.getByText('View temporal speed values').click();

            const tableRegion = page.getByRole('region', {
                name: 'Temporal speed values table',
            });

            await expect(tableRegion).toBeVisible();

            const table = tableRegion.getByRole('table', {
                name: 'Temporal WPM and Raw WPM measurements',
            });

            await expect(table).toBeVisible();

            expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);

            await expectNoDocumentOverflow(page);
        });
    });

    test('registration remains usable after real refresh rate limiting', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByTestId('typing-surface')).toBeVisible();

        const statuses = await page.evaluate(async () => {
            const results: number[] = [];

            for (let attempt = 0; attempt < 35; attempt += 1) {
                const response = await fetch('http://localhost:3003/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                results.push(response.status);
            }

            return results;
        });

        expect(statuses).toContain(429);

        const refreshResponsePromise = page.waitForResponse((response) => {
            const url = new URL(response.url());

            return url.pathname === '/auth/refresh' && response.request().method() === 'POST';
        });

        await page.goto('/register');

        const refreshResponse = await refreshResponsePromise;

        expect(refreshResponse.status()).toBe(429);

        await expect(
            page.getByRole('heading', {
                name: 'Create account',
            }),
        ).toBeVisible();

        await expect(page.getByLabel('Email')).toBeVisible();

        await expect(
            page.getByRole('alert').filter({
                hasText: 'Session recovery failed',
            }),
        ).toContainText('Session recovery failed');

        await page
            .getByLabel('Email', { exact: true })
            .fill(`rate-limit-${randomUUID()}@example.com`);

        await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple');

        await page
            .getByRole('button', {
                name: 'Create account',
            })
            .click();

        await expect(
            page.getByRole('button', {
                name: /^Account menu\b/u,
            }),
        ).toBeVisible();
    });
});
