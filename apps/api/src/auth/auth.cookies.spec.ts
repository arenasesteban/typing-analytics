import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { clearRefreshTokenCookie, setRefreshTokenCookie } from './auth.cookies.js';
import { MILLISECONDS_PER_DAY, REFRESH_COOKIE_NAME } from './auth.constants.js';

function createConfig(nodeEnvironment: 'development' | 'test' | 'production'): ConfigService {
    return new ConfigService({
        NODE_ENV: nodeEnvironment,
        REFRESH_TOKEN_TTL_DAYS: 30,
    });
}

function createResponseMock() {
    const cookie = vi.fn();
    const clearCookie = vi.fn();

    const response = {
        cookie,
        clearCookie,
    } as unknown as Response;

    return { response, cookie, clearCookie };
}

describe('Refresh cookie security', () => {
    it.each(['development', 'test'] as const)(
        'sets a protected non-Secure cookie in %s',
        (environment) => {
            const { response, cookie } = createResponseMock();

            setRefreshTokenCookie(response, 'test-refresh-token', createConfig(environment));

            expect(cookie).toHaveBeenCalledWith(
                REFRESH_COOKIE_NAME,
                'test-refresh-token',
                expect.objectContaining({
                    httpOnly: true,
                    secure: false,
                    sameSite: 'lax',
                    path: '/auth',
                    maxAge: 30 * MILLISECONDS_PER_DAY,
                }),
            );
        },
    );

    it('sets Secure on production refresh cookies', () => {
        const { response, cookie } = createResponseMock();

        setRefreshTokenCookie(response, 'test-refresh-token', createConfig('production'));

        expect(cookie).toHaveBeenCalledWith(
            REFRESH_COOKIE_NAME,
            'test-refresh-token',
            expect.objectContaining({
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                path: '/auth',
                maxAge: 30 * MILLISECONDS_PER_DAY,
            }),
        );
    });

    it.each([
        ['development', false],
        ['production', true],
    ] as const)(
        'clears the refresh cookie with matching attributes in %s',
        (environment, secure) => {
            const { response, clearCookie } = createResponseMock();

            clearRefreshTokenCookie(response, createConfig(environment));

            expect(clearCookie).toHaveBeenCalledWith(
                REFRESH_COOKIE_NAME,
                expect.objectContaining({
                    httpOnly: true,
                    secure,
                    sameSite: 'lax',
                    path: '/auth',
                }),
            );
        },
    );
});
