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

test('registers, logs in, completes a typing test, verifies behavioral analytics in private history, and checks the dashboard', async ({
    page,
}, testInfo) => {
    const email = `e2e-user-${String(testInfo.retry)}@example.com`;

    const password = 'TypingAnalyticsE2E!';

    // Register a new user.

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

    // Sign out.

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

    // Sign in and capture the server-created typing session.

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

    // Introduce one incorrect character and correct it with Backspace.

    const firstCharacter = Array.from(generatedTarget)[0];

    const incorrectCharacter = firstCharacter === 'x' ? 'z' : 'x';

    const typingSurface = page.getByTestId('typing-surface');

    await typingSurface.pressSequentially(incorrectCharacter);

    await typingSurface.press('Backspace');

    // Complete the exact target assigned by the API.

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

    await expect(page.getByTestId('result-wpm')).toBeVisible();

    await expect(page.getByTestId('result-raw-wpm')).toBeVisible();

    await expect(page.getByTestId('result-accuracy')).toBeVisible();

    await expect(page.getByTestId('result-errors')).toHaveText('1');

    // Verify the immediate behavioral visualization.

    const immediateChart = page.getByTestId('temporal-performance-chart');

    await expect(immediateChart).toBeVisible();

    await expect(immediateChart.locator('polyline')).toHaveCount(2);

    const immediateWpmCurve = immediateChart.getByTestId('chart-wpm-curve');

    const immediateRawWpmCurve = immediateChart.getByTestId('chart-raw-wpm-curve');

    const immediateWpmCoordinates = await immediateWpmCurve.getAttribute('points');

    const immediateRawWpmCoordinates = await immediateRawWpmCurve.getAttribute('points');

    if (
        immediateWpmCoordinates === null ||
        immediateWpmCoordinates.length === 0 ||
        immediateRawWpmCoordinates === null ||
        immediateRawWpmCoordinates.length === 0
    ) {
        throw new Error('Immediate behavioral curves have no SVG coordinates');
    }

    const immediateErrorMarker = immediateChart.getByTestId('error-marker-0');

    await expect(immediateErrorMarker).toBeVisible();

    await immediateErrorMarker.click();

    const immediateErrorDetail = immediateChart.getByTestId('selected-error-detail');

    await expect(immediateErrorDetail).toBeVisible();

    await expect(immediateErrorDetail).toContainText('Removed by Backspace');

    // Navigate to the authenticated session history.

    await page
        .getByRole('button', {
            name: 'Account menu',
        })
        .click();

    await Promise.all([
        page.waitForURL(/\/history$/, {
            timeout: 30_000,
        }),
        page
            .getByRole('menuitem', {
                name: 'history',
            })
            .click(),
    ]);

    await expect(page).toHaveURL(/\/history$/);

    const historyItem = page.getByTestId(`history-item-${sessionId}`);

    await expect(historyItem).toBeVisible();

    await Promise.all([
        page.waitForURL(new RegExp(`/history/${sessionId}$`), {
            timeout: 30_000,
        }),
        page
            .getByRole('link', {
                name: `Open session ${sessionId}`,
            })
            .click(),
    ]);

    const detail = page.getByTestId('history-detail');

    await expect(detail).toBeVisible();

    await expect(detail).toContainText(sessionId);

    await expect(page.getByTestId('history-detail-target')).toHaveText(generatedTarget);

    await expect(detail).toContainText('wpm');

    await expect(detail).toContainText('accuracy');

    await expect(detail).toContainText('consistency');

    // Wait for asynchronous event delivery.
    // The chart is rendered only when behavioral.status is READY.

    const historicalChart = page.getByTestId('temporal-performance-chart');

    const checkAgainButton = page.getByRole('button', {
        name: 'Check again',
        exact: true,
    });

    await expect
        .poll(
            async () => {
                if (await historicalChart.isVisible()) {
                    return true;
                }

                if (await checkAgainButton.isVisible()) {
                    await checkAgainButton.click();
                }

                return false;
            },
            {
                message: 'Historical behavioral analytics did not reach READY',
                intervals: [1_000],
                timeout: 30_000,
            },
        )
        .toBe(true);

    // Verify the historical visualization.

    await expect(historicalChart).toBeVisible();

    await expect(historicalChart.locator('polyline')).toHaveCount(2);

    const historicalWpmCurve = historicalChart.getByTestId('chart-wpm-curve');

    const historicalRawWpmCurve = historicalChart.getByTestId('chart-raw-wpm-curve');

    // The persisted and immediate charts must describe the same session.

    await expect(historicalWpmCurve).toHaveAttribute('points', immediateWpmCoordinates);

    await expect(historicalRawWpmCurve).toHaveAttribute('points', immediateRawWpmCoordinates);

    // The corrected error must also survive persistence.

    const historicalErrorMarker = historicalChart.getByTestId('error-marker-0');

    await expect(historicalErrorMarker).toBeVisible();

    await historicalErrorMarker.click();

    const historicalErrorDetail = historicalChart.getByTestId('selected-error-detail');

    await expect(historicalErrorDetail).toBeVisible();

    await expect(historicalErrorDetail).toContainText('Removed by Backspace');

    // Preserve the existing historical dashboard regression coverage.

    await page.goto('/dashboard');

    await expect(
        page.getByRole('heading', {
            name: 'Historical performance',
        }),
    ).toBeVisible();

    await expect(page.getByTestId('dashboard-data')).toBeVisible();

    await expect(page.getByTestId('dashboard-session-count')).toHaveText('1');

    await expect(page.getByTestId('dashboard-history-row')).toHaveCount(1);
});
