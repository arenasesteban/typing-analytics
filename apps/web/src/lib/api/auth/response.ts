import { isRecord } from '../shared/validation';

export interface AuthUser {
    readonly id: string;
    readonly email: string;
}

export interface AuthSession {
    readonly accessToken: string;
    readonly user: AuthUser;
}

export function isAuthUser(value: unknown): value is AuthUser {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        typeof value['email'] === 'string' &&
        value['email'].length > 0
    );
}

export function isAuthSession(value: unknown): value is AuthSession {
    return (
        isRecord(value) &&
        typeof value['accessToken'] === 'string' &&
        value['accessToken'].length > 0 &&
        isAuthUser(value['user'])
    );
}
