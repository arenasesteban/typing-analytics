import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from './http';

class TestApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
    }
}

function createTestClient() {
    return createApiClient({
        ErrorClass: TestApiError,
        errorMessagePrefix: 'Request failed',
        invalidResponseMessage: 'Invalid response',
        credentials: 'include',
    });
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe('API client URL resolution', () => {
    it('supports same-origin API requests', async () => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '/');

        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        vi.stubGlobal('fetch', fetchMock);

        const client = createTestClient();

        await client.requestJson(
            '/auth/register',
            { method: 'POST' },
            (value): value is { success: boolean } =>
                typeof value === 'object' &&
                value !== null &&
                'success' in value &&
                value.success === true,
        );

        expect(fetchMock).toHaveBeenCalledWith(
            '/auth/register',
            expect.objectContaining({
                method: 'POST',
                credentials: 'include',
            }),
        );
    });

    it('preserves absolute API origins', async () => {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:3001');

        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

        vi.stubGlobal('fetch', fetchMock);

        const client = createTestClient();

        await client.requestVoid('/auth/logout', {
            method: 'POST',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:3001/auth/logout',
            expect.objectContaining({
                credentials: 'include',
            }),
        );
    });
});
