import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

async function auditPage(page: Page): Promise<void> {
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();

    expect(
        results.violations,
        JSON.stringify(
            results.violations.map((violation) => ({
                id: violation.id,
                impact: violation.impact,
                nodes: violation.nodes.map((node) => node.target),
            })),
            null,
            2,
        ),
    ).toEqual([]);
}

test.describe('Cross-route accessibility', () => {
    test('public typing test exposes accessible landmarks and input', async ({ page }) => {
        await page.goto('/');

        await expect(
            page.getByRole('link', {
                name: 'Skip to main content',
            }),
        ).toBeAttached();

        await expect(
            page.getByRole('group', {
                name: 'Typing test input',
            }),
        ).toBeAttached();

        await auditPage(page);
    });

    test('skip link moves keyboard focus to main content', async ({ page }) => {
        await page.goto('/login');

        await expect(
            page.getByRole('heading', {
                name: 'Sign in',
            }),
        ).toBeVisible();

        await page.keyboard.press('Tab');

        await expect(
            page.getByRole('link', {
                name: 'Skip to main content',
            }),
        ).toBeFocused();

        await page.keyboard.press('Enter');

        await expect(page.locator('#main-content')).toBeFocused();
    });

    for (const route of ['/login', '/register']) {
        test(`${route} has no automated WCAG A/AA violations`, async ({ page }) => {
            await page.goto(route);

            await expect(
                page.getByRole('heading', {
                    level: 1,
                }),
            ).toBeVisible();

            await auditPage(page);
        });
    }

    test('private dashboard and history have accessible structures', async ({ page }) => {
        await page.goto('/register');

        await page.getByLabel('Email').fill(`a11y-${randomUUID()}@example.com`);

        await page.getByLabel('Password', { exact: true }).fill('correct-horse-battery-staple');

        await page.getByRole('button', { name: 'Create account' }).click();

        await expect(
            page.getByRole('button', {
                name: /^Account menu\b/,
            }),
        ).toBeVisible();

        await page.goto('/dashboard');

        await expect(
            page.getByRole('heading', {
                name: 'Historical performance',
            }),
        ).toBeVisible();

        await expect(page.getByTestId('dashboard-empty')).toBeVisible();

        await auditPage(page);

        await page.goto('/history');

        await expect(
            page.getByRole('heading', {
                level: 1,
            }),
        ).toBeVisible();

        await auditPage(page);
    });
});
