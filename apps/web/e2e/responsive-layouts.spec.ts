import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
    { label: 'narrow mobile', width: 320, height: 720 },
    { label: 'standard mobile', width: 375, height: 812 },
    { label: 'tablet', width: 768, height: 1024 },
    { label: 'desktop', width: 1280, height: 800 },
] as const;

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

    await page.getByLabel('Email').fill(`responsive-${randomUUID()}@example.com`);

    await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple');

    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(
        page.getByRole('button', {
            name: /^Account menu\b/,
        }),
    ).toBeVisible();
}

test.describe('Responsive application layouts', () => {
    test('public pages fit all supported viewports', async ({ page }) => {
        const routes = ['/', '/login', '/register'] as const;

        for (const route of routes) {
            await page.setViewportSize({
                width: VIEWPORTS[0].width,
                height: VIEWPORTS[0].height,
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
                        await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

                        await expect(page.getByLabel('Email')).toBeVisible();

                        await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
                    }

                    if (route === '/register') {
                        await expect(
                            page.getByRole('heading', { name: 'Create account' }),
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
            name: /^Account menu\b/,
        });

        for (const viewport of VIEWPORTS) {
            await test.step(`account menu fits ${viewport.label}`, async () => {
                await page.setViewportSize({
                    width: viewport.width,
                    height: viewport.height,
                });

                await expectNoDocumentOverflow(page);

                await accountButton.click();

                const accountMenu = page.locator('#account-menu');

                await expect(accountMenu).toBeVisible();

                const menuBounds = await accountMenu.boundingBox();

                expect(menuBounds).not.toBeNull();

                if (menuBounds !== null) {
                    expect(menuBounds.x).toBeGreaterThanOrEqual(-1);

                    expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(viewport.width + 1);
                }

                await accountButton.click();
            });
        }

        await page.setViewportSize({
            width: VIEWPORTS[0].width,
            height: VIEWPORTS[0].height,
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
            width: VIEWPORTS[0].width,
            height: VIEWPORTS[0].height,
        });

        await page.goto('/history');

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

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
        await page.setViewportSize({
            width: 320,
            height: 720,
        });

        await registerE2EUser(page);

        await expect(page.getByTestId('typing-surface')).toBeVisible();

        const targetContent = await page.locator('#typing-target-readable').textContent();

        expect(targetContent).not.toBeNull();

        const target = (targetContent ?? '').replace(/^\s*Target text:\s*/u, '').trim();

        expect(target.length).toBeGreaterThan(0);

        await page.getByTestId('typing-surface').focus();

        await page.keyboard.type(target, {
            delay: 20,
        });

        await expect(page.getByTestId('typing-results')).toBeVisible({ timeout: 90_000 });

        await expect(page.getByTestId('result-wpm')).toHaveText(/\d+/u);

        await expect(page.getByRole('button', { name: 'Restart test' })).toBeVisible();

        await expectNoDocumentOverflow(page);

        await page.goto('/dashboard');

        await expect(page.getByTestId('dashboard-data')).toBeVisible();

        await expect(page.getByTestId('dashboard-history-row').first()).toBeVisible();

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

        await page.goto('/history');

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        await expectNoDocumentOverflow(page);
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

        await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

        await expect(page.getByLabel('Email')).toBeVisible();

        await expect(
            page.getByRole('alert').filter({
                hasText: 'Session recovery failed',
            }),
        ).toContainText('Session recovery failed');

        await page.getByLabel('Email').fill(`rate-limit-${randomUUID()}@example.com`);

        await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple');

        await page.getByRole('button', { name: 'Create account' }).click();

        await expect(
            page.getByRole('button', {
                name: /^Account menu\b/,
            }),
        ).toBeVisible();
    });
});
