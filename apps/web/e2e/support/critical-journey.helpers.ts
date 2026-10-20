import { randomUUID } from 'node:crypto';

import { expect, type Page } from '@playwright/test';

export const E2E_API_URL = 'http://localhost:3003';

export interface TestAccount {
    readonly email: string;
    readonly password: string;
}

export interface CompletedJourneySession {
    readonly id: string;
    readonly target: string;
}

export function createTestAccount(): TestAccount {
    return {
        email: `journey-${randomUUID()}@example.com`,
        password: 'correct-horse-battery-staple',
    };
}

export async function registerAccount(page: Page, account: TestAccount): Promise<void> {
    await page.goto('/register');
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('button', { name: /^Account menu\b/ })).toBeVisible();
}

export async function logoutAccount(page: Page): Promise<void> {
    await page.getByRole('button', { name: /^Account menu\b/ }).click();
    await page.getByRole('button', { name: /^sign out$/i }).click();
    await expect(page.getByRole('link', { name: 'sign in' })).toBeVisible();
}

export async function loginAccount(page: Page, account: TestAccount): Promise<void> {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: /^Account menu\b/ })).toBeVisible();
}

interface CompletionPayload {
    readonly id: string;
    readonly typingText: {
        readonly text: string;
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCompletionPayload(value: unknown): value is CompletionPayload {
    if (!isRecord(value) || typeof value['id'] !== 'string') {
        return false;
    }

    const typingText = value['typingText'];
    return isRecord(typingText) && typeof typingText['text'] === 'string';
}

export async function completeBrowserTypingSession(page: Page): Promise<CompletedJourneySession> {
    const surface = page.getByTestId('typing-surface');
    await expect(surface).toBeVisible({ timeout: 30_000 });

    // Preserve leading and trailing target characters exactly.
    const target = await page.getByTestId('typing-text').textContent();
    if (target === null || target.length === 0) {
        throw new Error('Typing target is unavailable');
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

    await surface.focus();
    await surface.pressSequentially(target, { delay: 2 });

    const response = await completionResponsePromise;
    expect(response.status()).toBe(200);

    const payload: unknown = await response.json();
    if (!isCompletionPayload(payload) || payload.id.length === 0) {
        throw new Error('Completion did not return a valid persisted session');
    }

    expect(payload.typingText.text).toBe(target);
    await expect(page.getByTestId('typing-results')).toBeVisible();
    await expect(page.getByText('session saved', { exact: true })).toBeVisible();
    await expect(page.getByTestId('result-wpm')).toHaveText(/\d+/u);

    return { id: payload.id, target };
}

export async function restartBrowserTypingSession(page: Page): Promise<void> {
    await page.getByRole('button', { name: 'Restart test' }).click();
    await expect(page.getByTestId('typing-surface')).toBeVisible({ timeout: 30_000 });
}

export async function openHistoryDetail(page: Page, sessionId: string): Promise<void> {
    await page.goto('/history');
    await expect(page.getByTestId(`history-item-${sessionId}`)).toBeVisible();
    await page.getByRole('link', { name: `Open session ${sessionId}` }).click();
    await expect(page).toHaveURL(new RegExp(`/history/${sessionId}$`, 'u'));
    await expect(page.getByTestId('history-detail')).toBeVisible();
}
