import { createApiClient } from '../shared/http';
import { isAuthSession, isAuthUser } from './response';

export type { AuthSession, AuthUser } from './response';

export class AuthApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AuthApiError';
    }
}

const { requestJson, requestVoid } = createApiClient({
    ErrorClass: AuthApiError,
    errorMessagePrefix: 'Authentication request failed',
    invalidResponseMessage: 'Authentication API returned an invalid response',
    credentials: 'include',
});

export function registerUser(
    email: string,
    password: string,
): Promise<import('./response').AuthSession> {
    return requestJson(
        '/auth/register',
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
            }),
        },
        isAuthSession,
    );
}

export function loginUser(
    email: string,
    password: string,
): Promise<import('./response').AuthSession> {
    return requestJson(
        '/auth/login',
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
            }),
        },
        isAuthSession,
    );
}

export function refreshAuthSession(): Promise<import('./response').AuthSession> {
    return requestJson(
        '/auth/refresh',
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
            },
        },
        isAuthSession,
    );
}

export function getCurrentUser(accessToken: string): Promise<import('./response').AuthUser> {
    return requestJson(
        '/auth/me',
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
        isAuthUser,
    );
}

export function logoutUser(): Promise<void> {
    return requestVoid('/auth/logout', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
        },
    });
}
