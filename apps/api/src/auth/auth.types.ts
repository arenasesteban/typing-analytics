import type { Request } from 'express';

export interface AuthUserResponse {
    id: string;
    email: string;
}

export interface AuthSessionResponse {
    accessToken: string;
    user: AuthUserResponse;
}

export interface IssuedAuthSession {
    response: AuthSessionResponse;
    refreshToken: string;
}

export interface AccessTokenPayload {
    sub: string;
    email: string;
}

export interface AuthenticatedIdentity {
    userId: string;
    email: string;
}

export interface AuthenticatedRequest extends Request {
    auth: AuthenticatedIdentity;
}
