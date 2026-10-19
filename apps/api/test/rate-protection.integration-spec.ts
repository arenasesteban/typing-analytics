import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthSessionResponse } from '../src/auth/auth.types.js';
import { RATE_LIMITS } from '../src/security/rate-protection.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const VALID_PASSWORD = 'correct-horse-battery-staple';
const SESSION_ID = '00000000-0000-4000-8000-000000000001';

describe('Targeted API rate protection', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let createdUserIds: string[];

    beforeEach(async () => {
        createdUserIds = [];

        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();

        await app.init();

        prisma = app.get(PrismaService);
    });

    afterEach(async () => {
        if (createdUserIds.length > 0) {
            await prisma.user.deleteMany({
                where: {
                    id: {
                        in: createdUserIds,
                    },
                },
            });
        }

        await app.close();
    });

    async function registerUser(): Promise<AuthSessionResponse> {
        const response = await request(app.getHttpServer())
            .post('/auth/register')
            .send({
                email: `rate-protection-${randomUUID()}@example.com`,
                password: VALID_PASSWORD,
            })
            .expect(201);

        const body = response.body as AuthSessionResponse;

        createdUserIds.push(body.user.id);

        return body;
    }

    it('limits registration despite spoofed forwarding headers', async () => {
        for (let index = 0; index < RATE_LIMITS.register; index++) {
            await request(app.getHttpServer())
                .post('/auth/register')
                .set('X-Forwarded-For', `192.0.2.${index + 1}`)
                .send({})
                .expect(400);
        }

        const blocked = await request(app.getHttpServer())
            .post('/auth/register')
            .set('X-Forwarded-For', '198.51.100.200')
            .send({})
            .expect(429);

        expect(blocked.body).toEqual(
            expect.objectContaining({
                statusCode: 429,
                message: 'Too many requests',
            }),
        );

        expect(JSON.stringify(blocked.body)).not.toMatch(
            /password|accessToken|refreshToken|connectionString|stack/i,
        );

        await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
    });

    it('limits login independently of refresh', async () => {
        for (let index = 0; index < RATE_LIMITS.login; index++) {
            await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
        }

        await request(app.getHttpServer()).post('/auth/login').send({}).expect(429);

        await request(app.getHttpServer()).post('/auth/refresh').expect(401);
    });

    it('limits repeated refresh attempts', async () => {
        for (let index = 0; index < RATE_LIMITS.refresh; index++) {
            await request(app.getHttpServer()).post('/auth/refresh').expect(401);
        }

        const blocked = await request(app.getHttpServer()).post('/auth/refresh').expect(429);

        expect(blocked.body).toEqual(
            expect.objectContaining({
                statusCode: 429,
                message: 'Too many requests',
            }),
        );
    });

    it('isolates session creation limits by authenticated user', async () => {
        const userA = await registerUser();
        const userB = await registerUser();

        for (let index = 0; index < RATE_LIMITS.sessionCreate; index++) {
            await request(app.getHttpServer())
                .post('/typing-sessions')
                .set('Authorization', `Bearer ${userA.accessToken}`)
                .send({ unexpected: true })
                .expect(400);
        }

        await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .send({ unexpected: true })
            .expect(429);

        const allowed = await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', `Bearer ${userB.accessToken}`)
            .send({})
            .expect(201);

        expect(allowed.body).toEqual(
            expect.objectContaining({
                id: expect.any(String),
            }),
        );
    });

    it('isolates session completion limits from other writes', async () => {
        const userA = await registerUser();
        const userB = await registerUser();

        for (let index = 0; index < RATE_LIMITS.sessionComplete; index++) {
            await request(app.getHttpServer())
                .post(`/typing-sessions/${SESSION_ID}/complete`)
                .set('Authorization', `Bearer ${userA.accessToken}`)
                .send({})
                .expect(400);
        }

        await request(app.getHttpServer())
            .post(`/typing-sessions/${SESSION_ID}/complete`)
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .send({})
            .expect(429);

        await request(app.getHttpServer())
            .post(`/typing-sessions/${SESSION_ID}/complete`)
            .set('Authorization', `Bearer ${userB.accessToken}`)
            .send({})
            .expect(400);

        await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', `Bearer ${userA.accessToken}`)
            .send({})
            .expect(201);
    });

    it('does not restrict health checks or authenticated reads', async () => {
        const user = await registerUser();

        for (let index = 0; index < 35; index++) {
            await request(app.getHttpServer()).get('/health/live').expect(200);

            await request(app.getHttpServer())
                .get('/auth/me')
                .set('Authorization', `Bearer ${user.accessToken}`)
                .expect(200);
        }
    });
});
