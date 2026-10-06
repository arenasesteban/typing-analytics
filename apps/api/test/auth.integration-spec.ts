import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { REFRESH_COOKIE_NAME } from '../src/auth/auth.constants.js';
import type { AuthSessionResponse } from '../src/auth/auth.types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const VALID_PASSWORD = 'correct-horse-battery-staple';

interface ResponseWithHeaders {
    headers: Record<string, string | string[] | undefined>;
}

interface RefreshCookie {
    cookieHeader: string;
    cookiePair: string;
    token: string;
}

function getSetCookieHeaders(response: ResponseWithHeaders): string[] {
    const value = response.headers['set-cookie'];

    if (value === undefined) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
}

function extractRefreshCookie(response: ResponseWithHeaders): RefreshCookie {
    const cookieHeader = getSetCookieHeaders(response).find((value) =>
        value.startsWith(`${REFRESH_COOKIE_NAME}=`),
    );

    if (cookieHeader === undefined) {
        throw new Error('Refresh cookie was not returned');
    }

    const cookiePair = cookieHeader.split(';')[0];

    if (cookiePair === undefined) {
        throw new Error('Refresh cookie is malformed');
    }

    const encodedToken = cookiePair.slice(`${REFRESH_COOKIE_NAME}=`.length);

    return {
        cookieHeader,
        cookiePair,
        token: decodeURIComponent(encodedToken),
    };
}

function hashRefreshToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

describe('Authentication API', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
    });

    beforeEach(async () => {
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();
    });

    afterAll(async () => {
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();
        await app.close();
    });

    it('registers a normalized user and stores only protected credentials', async () => {
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'User@Example.COM',
                password: VALID_PASSWORD,
            })
            .expect(201);

        const body = response.body as AuthSessionResponse;
        const refreshCookie = extractRefreshCookie(response);

        expect(body.accessToken).toEqual(expect.any(String));
        expect(body.user).toEqual({
            id: expect.any(String),
            email: 'user@example.com',
        });

        expect(refreshCookie.cookieHeader).toContain('HttpOnly');
        expect(refreshCookie.cookieHeader).toContain('SameSite=Lax');
        expect(refreshCookie.cookieHeader).toContain('Path=/auth');

        const persistedUser = await prisma.user.findUnique({
            where: {
                email: 'user@example.com',
            },
        });

        expect(persistedUser).not.toBeNull();
        expect(persistedUser?.passwordHash).not.toBe(VALID_PASSWORD);
        expect(persistedUser?.passwordHash).toMatch(/^\$argon2id\$v=19\$/);

        const persistedRefreshSession = await prisma.refreshSession.findUnique({
            where: {
                tokenHash: hashRefreshToken(refreshCookie.token),
            },
        });

        expect(persistedRefreshSession).not.toBeNull();
        expect(persistedRefreshSession?.tokenHash).not.toBe(refreshCookie.token);
        expect(persistedRefreshSession?.revokedAt).toBeNull();
    });

    it('rejects duplicate normalized emails', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'User@Example.com',
                password: VALID_PASSWORD,
            })
            .expect(201);

        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'user@example.COM',
                password: VALID_PASSWORD,
            })
            .expect(409);

        expect(await prisma.user.count()).toBe(1);
    });

    it('rejects invalid registration payloads', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'not-an-email',
                password: 'short',
                role: 'admin',
            })
            .expect(400);

        expect(await prisma.user.count()).toBe(0);
    });

    it('logs in valid credentials and rejects invalid credentials', async () => {
        await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'user@example.com',
                password: VALID_PASSWORD,
            })
            .expect(201);

        const loginResponse = await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'USER@example.com',
                password: VALID_PASSWORD,
            })
            .expect(200);

        const loginBody = loginResponse.body as AuthSessionResponse;

        expect(loginBody.accessToken).toEqual(expect.any(String));
        expect(loginBody.user.email).toBe('user@example.com');

        await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'user@example.com',
                password: 'incorrect-password',
            })
            .expect(401);

        await request(app.getHttpServer())
            .post('/auth/login')
            .send({
                email: 'missing@example.com',
                password: VALID_PASSWORD,
            })
            .expect(401);
    });

    it('rotates refresh credentials and rejects reuse of the previous credential', async () => {
        const registerResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'user@example.com',
                password: VALID_PASSWORD,
            })
            .expect(201);

        const oldRefreshCookie = extractRefreshCookie(registerResponse);

        const refreshResponse = await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Cookie', oldRefreshCookie.cookiePair)
            .expect(200);

        const refreshedBody = refreshResponse.body as AuthSessionResponse;
        const newRefreshCookie = extractRefreshCookie(refreshResponse);

        expect(refreshedBody.accessToken).toEqual(expect.any(String));
        expect(newRefreshCookie.token).not.toBe(oldRefreshCookie.token);

        const oldSession = await prisma.refreshSession.findUnique({
            where: {
                tokenHash: hashRefreshToken(oldRefreshCookie.token),
            },
        });

        const newSession = await prisma.refreshSession.findUnique({
            where: {
                tokenHash: hashRefreshToken(newRefreshCookie.token),
            },
        });

        expect(oldSession?.revokedAt).not.toBeNull();
        expect(newSession?.revokedAt).toBeNull();

        await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Cookie', oldRefreshCookie.cookiePair)
            .expect(401);
    });

    it('rejects expired and unknown refresh credentials', async () => {
        const registerResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'user@example.com',
                password: VALID_PASSWORD,
            })
            .expect(201);

        const refreshCookie = extractRefreshCookie(registerResponse);

        await prisma.refreshSession.update({
            where: {
                tokenHash: hashRefreshToken(refreshCookie.token),
            },
            data: {
                expiresAt: new Date(Date.now() - 1000),
            },
        });

        await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Cookie', refreshCookie.cookiePair)
            .expect(401);

        await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Cookie', `${REFRESH_COOKIE_NAME}=unknown-refresh-token`)
            .expect(401);
    });

    it('revokes the renewable session on logout', async () => {
        const registerResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'user@example.com',
                password: VALID_PASSWORD,
            })
            .expect(201);

        const refreshCookie = extractRefreshCookie(registerResponse);

        await request(app.getHttpServer())
            .post('/auth/logout')
            .set('Cookie', refreshCookie.cookiePair)
            .expect(204);

        const persistedSession = await prisma.refreshSession.findUnique({
            where: {
                tokenHash: hashRefreshToken(refreshCookie.token),
            },
        });

        expect(persistedSession?.revokedAt).not.toBeNull();

        await request(app.getHttpServer())
            .post('/auth/refresh')
            .set('Cookie', refreshCookie.cookiePair)
            .expect(401);
    });

    it('returns current identity only for a valid access token', async () => {
        const registerResponse = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: 'user@example.com',
                password: VALID_PASSWORD,
            })
            .expect(201);

        const registerBody = registerResponse.body as AuthSessionResponse;

        await request(app.getHttpServer()).get('/auth/me').expect(401);

        const meResponse = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${registerBody.accessToken}`)
            .expect(200);

        expect(meResponse.body).toEqual({
            id: registerBody.user.id,
            email: 'user@example.com',
        });

        await request(app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', 'Bearer invalid-token')
            .expect(401);
    });
});
