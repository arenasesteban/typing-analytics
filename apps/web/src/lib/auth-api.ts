export interface AuthUser {
    readonly id: string;
    readonly email: string;
}

export interface AuthSession {
    readonly accessToken: string;
    readonly user: AuthUser;
}

export class AuthApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AuthApiError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAuthUser(value: unknown): value is AuthUser {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        typeof value['email'] === 'string' &&
        value['email'].length > 0
    );
}

function isAuthSession(value: unknown): value is AuthSession {
    return (
        isRecord(value) &&
        typeof value['accessToken'] === 'string' &&
        value['accessToken'].length > 0 &&
        isAuthUser(value['user'])
    );
}

function getApiBaseUrl(): string {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (configuredBaseUrl === undefined || configuredBaseUrl.trim().length === 0) {
        throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(configuredBaseUrl);
    } catch {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS URL');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS URL');
    }

    return parsedUrl.toString().replace(/\/+$/, '');
}

async function readResponseBody(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function getErrorMessage(body: unknown, status: number): string {
    if (isRecord(body)) {
        const message = body['message'];

        if (typeof message === 'string' && message.length > 0) {
            return message;
        }

        if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
            return message.join(', ');
        }
    }

    return `Authentication request failed with status ${String(status)}`;
}

async function requestJson<T>(
    path: string,
    init: RequestInit,
    isExpectedResponse: (value: unknown) => value is T,
): Promise<T> {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...init,
        credentials: 'include',
    });

    const body = await readResponseBody(response);

    if (!response.ok) {
        throw new AuthApiError(getErrorMessage(body, response.status), response.status);
    }

    if (!isExpectedResponse(body)) {
        throw new Error('Authentication API returned an invalid response');
    }

    return body;
}

export function registerUser(email: string, password: string): Promise<AuthSession> {
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

export function loginUser(email: string, password: string): Promise<AuthSession> {
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

export function refreshAuthSession(): Promise<AuthSession> {
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

export function getCurrentUser(accessToken: string): Promise<AuthUser> {
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

export async function logoutUser(): Promise<void> {
    const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
        },
        credentials: 'include',
    });

    if (response.ok) {
        return;
    }

    const body = await readResponseBody(response);

    throw new AuthApiError(getErrorMessage(body, response.status), response.status);
}
