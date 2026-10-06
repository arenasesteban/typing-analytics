import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

import { MILLISECONDS_PER_DAY, REFRESH_COOKIE_NAME } from './auth.constants.js';

function getBaseRefreshCookieOptions(configService: ConfigService): CookieOptions {
    return {
        httpOnly: true,
        secure: configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
        path: '/auth',
    };
}

export function setRefreshTokenCookie(
    response: Response,
    token: string,
    configService: ConfigService,
): void {
    const lifetimeDays = configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');

    response.cookie(REFRESH_COOKIE_NAME, token, {
        ...getBaseRefreshCookieOptions(configService),
        maxAge: lifetimeDays * MILLISECONDS_PER_DAY,
    });
}

export function clearRefreshTokenCookie(response: Response, configService: ConfigService): void {
    response.clearCookie(REFRESH_COOKIE_NAME, getBaseRefreshCookieOptions(configService));
}

export function readRefreshTokenCookie(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie;

    if (cookieHeader === undefined) {
        return undefined;
    }

    for (const cookie of cookieHeader.split(';')) {
        const separatorIndex = cookie.indexOf('=');

        if (separatorIndex < 0) {
            continue;
        }

        const name = cookie.slice(0, separatorIndex).trim();

        if (name !== REFRESH_COOKIE_NAME) {
            continue;
        }

        const value = cookie.slice(separatorIndex + 1).trim();

        if (value.length === 0) {
            return undefined;
        }

        try {
            return decodeURIComponent(value);
        } catch {
            return undefined;
        }
    }

    return undefined;
}
