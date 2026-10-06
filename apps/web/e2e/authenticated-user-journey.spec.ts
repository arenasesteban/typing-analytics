import { expect, test } from '@playwright/test';

interface CreatedSessionPayload {
    readonly id: string;
    readonly typingText: {
        readonly id: string;
        readonly text: string;
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCreatedSessionPayload(value: unknown): value is CreatedSessionPayload {
    if (!isRecord(value)) {
        return false;
    }

    const typingText = value['typingText'];

    return (
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        isRecord(typingText) &&
        typeof typingText['id'] === 'string' &&
        typingText['id'].length > 0 &&
        typeof typingText['text'] === 'string' &&
        typingText['text'].length > 0
    );
}

test('registers, logs in, completes a generated test, and opens the persisted session from private history', async ({
    page,
}, testInfo) => {
    const email = `e2e-user-${String(testInfo.retry)}@example.com`;

    const password = 'TypingAnalyticsE2E!';

    await page.goto('/register');

    await page.getByLabel('Email', { exact: true }).fill(email);

    await page.getByLabel('Password', { exact: true }).fill(password);

    const registerResponsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/auth/register' &&
            response.request().method() === 'POST',
    );

    await page
        .getByRole('button', {
            name: 'Create account',
        })
        .click();

    const registerResponse = await registerResponsePromise;

    expect(registerResponse.ok()).toBe(true);

    await expect(page).toHaveURL(/\/$/);

    await expect(page.getByTestId('session-mode')).toHaveText('authenticated');

    await expect(page.getByTestId('persistence-status')).toHaveText('ready');

    await page
        .getByRole('button', {
            name: 'Account menu',
        })
        .click();

    await page
        .getByRole('menuitem', {
            name: 'sign out',
        })
        .click();

    await expect(
        page.getByRole('link', {
            name: 'sign in',
        }),
    ).toBeVisible();

    await page.goto('/login');

    await page.getByLabel('Email', { exact: true }).fill(email);

    await page.getByLabel('Password', { exact: true }).fill(password);

    const loginResponsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/auth/login' &&
            response.request().method() === 'POST',
    );

    const createdSessionResponsePromise = page.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === '/typing-sessions' &&
            response.request().method() === 'POST' &&
            response.status() === 201,
    );

    await page
        .getByRole('button', {
            name: 'Sign in',
        })
        .click();

    const loginResponse = await loginResponsePromise;

    expect(loginResponse.ok()).toBe(true);

    const createdSessionResponse = await createdSessionResponsePromise;

    const createdSessionBody: unknown = await createdSessionResponse.json();

    if (!isCreatedSessionPayload(createdSessionBody)) {
        throw new Error('Typing-session creation returned an unexpected E2E payload');
    }

    const sessionId = createdSessionBody.id;

    const generatedTarget = createdSessionBody.typingText.text;

    await expect(page).toHaveURL(/\/$/);

    await expect(page.getByTestId('session-mode')).toHaveText('authenticated');

    await expect(page.getByTestId('persistence-status')).toHaveText('ready');

    await expect(page.getByTestId('typing-text')).toHaveText(generatedTarget);

    const typingSurface = page.getByTestId('typing-surface');

    await typingSurface.pressSequentially(generatedTarget, {
        delay: 2,
    });

    await expect(page.getByTestId('typing-results')).toBeVisible();

    await expect(
        page.getByText('session saved', {
            exact: true,
        }),
    ).toBeVisible();

    await expect(page.getByTestId('persistence-status')).toHaveText('completed');

    await page
        .getByRole('button', {
            name: 'Account menu',
        })
        .click();

    await page
        .getByRole('menuitem', {
            name: 'history',
        })
        .click();

    await expect(page).toHaveURL(/\/history$/);

    const historyItem = page.getByTestId(`history-item-${sessionId}`);

    await expect(historyItem).toBeVisible();

    await page
        .getByRole('link', {
            name: `Open session ${sessionId}`,
        })
        .click();

    await expect(page).toHaveURL(new RegExp(`/history/${sessionId}$`));

    const detail = page.getByTestId('history-detail');

    await expect(detail).toBeVisible();

    await expect(detail).toContainText(sessionId);

    await expect(page.getByTestId('history-detail-target')).toHaveText(generatedTarget);

    await expect(detail).toContainText('wpm');

    await expect(detail).toContainText('accuracy');

    await expect(detail).toContainText('consistency');
});
