import { expect, test } from '@playwright/test';

test.describe('Same-origin API routing', () => {
    test('forwards health requests through the web origin', async ({ page }) => {
        await page.goto('/');

        const results = await page.evaluate(async () => {
            const paths = ['/health/live', '/health/ready'] as const;

            return Promise.all(
                paths.map(async (path) => {
                    const response = await fetch(path, {
                        credentials: 'include',
                        cache: 'no-store',
                    });

                    return {
                        path,
                        status: response.status,
                        url: response.url,
                    };
                }),
            );
        });

        const webOrigin = new URL(page.url()).origin;

        for (const result of results) {
            expect(result.status, `${result.path} must be healthy`).toBe(200);
            expect(new URL(result.url).origin).toBe(webOrigin);
            expect(new URL(result.url).pathname).toBe(result.path);
        }
    });

    test('rejects unauthenticated access to sessions', async ({ page }) => {
        await page.goto('/');

        const result = await page.evaluate(async () => {
            const response = await fetch('/typing-sessions', {
                credentials: 'include',
                cache: 'no-store',
            });

            return {
                status: response.status,
                url: response.url,
            };
        });

        expect(result.status).toBe(401);
        expect(new URL(result.url).origin).toBe(new URL(page.url()).origin);
    });

    test('keeps browser API traffic on the web origin', async ({ page }) => {
        const requests: string[] = [];

        page.on('request', (request) => {
            if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
                requests.push(request.url());
            }
        });

        await page.goto('/');

        await page.evaluate(async () => {
            await fetch('/health/live', {
                credentials: 'include',
                cache: 'no-store',
            });
        });

        const webOrigin = new URL(page.url()).origin;

        for (const requestUrl of requests) {
            expect(new URL(requestUrl).origin).toBe(webOrigin);
        }

        expect(requests.some((url) => new URL(url).pathname === '/health/live')).toBe(true);
    });
});
