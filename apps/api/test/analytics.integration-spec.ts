import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthSessionResponse } from '../src/auth/auth.types.js';
import type { AnalyticsOverviewResponse } from '../src/analytics/analytics.types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const VALID_PASSWORD = 'correct-horse-battery-staple';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface CompletedSessionFixture {
    readonly userId: string;
    readonly completedAt: Date;
    readonly wpm: number;
    readonly accuracy: number;
    readonly consistency: number;
}

let typingTextSequence = 0;

async function registerUser(app: INestApplication, email: string): Promise<AuthSessionResponse> {
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
            email,
            password: VALID_PASSWORD,
        })
        .expect(201);

    return response.body as AuthSessionResponse;
}

async function createCompletedSession(
    prisma: PrismaService,
    fixture: CompletedSessionFixture,
): Promise<void> {
    typingTextSequence += 1;

    const typingText = await prisma.typingText.create({
        data: {
            text: `analytics target ${typingTextSequence}`,
        },
    });

    await prisma.typingSession.create({
        data: {
            userId: fixture.userId,
            typingTextId: typingText.id,
            durationMs: 60_000,
            wpm: fixture.wpm,
            rawWpm: fixture.wpm + 5,
            accuracy: fixture.accuracy,
            consistency: fixture.consistency,
            totalInputs: 100,
            correctInputs: 95,
            incorrectInputs: 5,
            startedAt: new Date(fixture.completedAt.getTime() - 60_000),
            completedAt: fixture.completedAt,
        },
    });
}

async function createIncompleteSession(prisma: PrismaService, userId: string): Promise<void> {
    typingTextSequence += 1;

    const typingText = await prisma.typingText.create({
        data: {
            text: `analytics target ${typingTextSequence}`,
        },
    });

    await prisma.typingSession.create({
        data: {
            userId,
            typingTextId: typingText.id,
        },
    });
}

async function resetDatabase(prisma: PrismaService): Promise<void> {
    await prisma.typingSession.deleteMany();
    await prisma.typingText.deleteMany();
    await prisma.refreshSession.deleteMany();
    await prisma.user.deleteMany();
}

describe('GET /analytics/overview', () => {
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
        typingTextSequence = 0;
        await resetDatabase(prisma);
    });

    afterAll(async () => {
        await resetDatabase(prisma);
        await app.close();
    });

    it('rejects unauthenticated requests', async () => {
        await request(app.getHttpServer()).get('/analytics/overview').expect(401);
    });

    it('returns an empty 30d overview when the user has no completed sessions', async () => {
        const auth = await registerUser(app, 'empty@example.com');

        const response = await request(app.getHttpServer())
            .get('/analytics/overview')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        expect(response.body).toEqual({
            range: '30d',
            summary: {
                sessionCount: 0,
                recentWpm: null,
                recentAccuracy: null,
                consistency: null,
            },
            trends: [],
        });
    });

    it('returns the expected overview for a single completed session', async () => {
        const auth = await registerUser(app, 'single@example.com');
        const completedAt = new Date(Date.now() - DAY_IN_MS);

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt,
            wpm: 55,
            accuracy: 96,
            consistency: 88,
        });

        const response = await request(app.getHttpServer())
            .get('/analytics/overview?range=30d')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        expect(response.body).toEqual({
            range: '30d',
            summary: {
                sessionCount: 1,
                recentWpm: 55,
                recentAccuracy: 96,
                consistency: 88,
            },
            trends: [
                {
                    completedAt: completedAt.toISOString(),
                    wpm: 55,
                    accuracy: 96,
                },
            ],
        });
    });

    it('aggregates multiple sessions and returns trends in chronological order', async () => {
        const auth = await registerUser(app, 'multiple@example.com');
        const now = Date.now();

        const oldestAt = new Date(now - 3 * DAY_IN_MS);
        const middleAt = new Date(now - 2 * DAY_IN_MS);
        const recentAt = new Date(now - DAY_IN_MS);

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: recentAt,
            wpm: 70,
            accuracy: 98,
            consistency: 96,
        });

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: oldestAt,
            wpm: 40,
            accuracy: 90,
            consistency: 72,
        });

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: middleAt,
            wpm: 55,
            accuracy: 94,
            consistency: 84,
        });

        const response = await request(app.getHttpServer())
            .get('/analytics/overview?range=all')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        const body = response.body as AnalyticsOverviewResponse;

        expect(body.range).toBe('all');
        expect(body.summary).toEqual({
            sessionCount: 3,
            recentWpm: 70,
            recentAccuracy: 98,
            consistency: 84,
        });

        expect(body.trends).toEqual([
            {
                completedAt: oldestAt.toISOString(),
                wpm: 40,
                accuracy: 90,
            },
            {
                completedAt: middleAt.toISOString(),
                wpm: 55,
                accuracy: 94,
            },
            {
                completedAt: recentAt.toISOString(),
                wpm: 70,
                accuracy: 98,
            },
        ]);
    });

    it('applies 7d, 30d, all, and the default 30d range', async () => {
        const auth = await registerUser(app, 'ranges@example.com');
        const now = Date.now();

        const oldAt = new Date(now - 45 * DAY_IN_MS);
        const middleAt = new Date(now - 15 * DAY_IN_MS);
        const recentAt = new Date(now - 2 * DAY_IN_MS);

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: oldAt,
            wpm: 35,
            accuracy: 88,
            consistency: 70,
        });

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: middleAt,
            wpm: 50,
            accuracy: 93,
            consistency: 80,
        });

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: recentAt,
            wpm: 65,
            accuracy: 97,
            consistency: 90,
        });

        const sevenDayResponse = await request(app.getHttpServer())
            .get('/analytics/overview?range=7d')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        const thirtyDayResponse = await request(app.getHttpServer())
            .get('/analytics/overview?range=30d')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        const defaultResponse = await request(app.getHttpServer())
            .get('/analytics/overview')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        const allResponse = await request(app.getHttpServer())
            .get('/analytics/overview?range=all')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        const sevenDayBody = sevenDayResponse.body as AnalyticsOverviewResponse;
        const thirtyDayBody = thirtyDayResponse.body as AnalyticsOverviewResponse;
        const defaultBody = defaultResponse.body as AnalyticsOverviewResponse;
        const allBody = allResponse.body as AnalyticsOverviewResponse;

        expect(sevenDayBody.summary.sessionCount).toBe(1);
        expect(sevenDayBody.trends.map((point) => point.completedAt)).toEqual([
            recentAt.toISOString(),
        ]);

        expect(thirtyDayBody.summary.sessionCount).toBe(2);
        expect(thirtyDayBody.trends.map((point) => point.completedAt)).toEqual([
            middleAt.toISOString(),
            recentAt.toISOString(),
        ]);

        expect(defaultBody.range).toBe('30d');
        expect(defaultBody.summary.sessionCount).toBe(2);

        expect(allBody.summary.sessionCount).toBe(3);
        expect(allBody.trends.map((point) => point.completedAt)).toEqual([
            oldAt.toISOString(),
            middleAt.toISOString(),
            recentAt.toISOString(),
        ]);
    });

    it('applies the temporal range boundary using completedAt', async () => {
        const auth = await registerUser(app, 'boundary@example.com');
        const now = Date.now();

        const insideBoundary = new Date(now - 7 * DAY_IN_MS + 60_000);
        const outsideBoundary = new Date(now - 7 * DAY_IN_MS - 60_000);

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: outsideBoundary,
            wpm: 40,
            accuracy: 90,
            consistency: 75,
        });

        await createCompletedSession(prisma, {
            userId: auth.user.id,
            completedAt: insideBoundary,
            wpm: 60,
            accuracy: 96,
            consistency: 85,
        });

        const response = await request(app.getHttpServer())
            .get('/analytics/overview?range=7d')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(200);

        const body = response.body as AnalyticsOverviewResponse;

        expect(body.summary.sessionCount).toBe(1);
        expect(body.trends).toEqual([
            {
                completedAt: insideBoundary.toISOString(),
                wpm: 60,
                accuracy: 96,
            },
        ]);
    });

    it('rejects unsupported temporal ranges', async () => {
        const auth = await registerUser(app, 'invalid-range@example.com');

        await request(app.getHttpServer())
            .get('/analytics/overview?range=90d')
            .set('Authorization', `Bearer ${auth.accessToken}`)
            .expect(400);
    });

    it('isolates sessions by user and excludes incomplete sessions', async () => {
        const owner = await registerUser(app, 'owner@example.com');
        const otherUser = await registerUser(app, 'other@example.com');
        const now = new Date();

        await createCompletedSession(prisma, {
            userId: owner.user.id,
            completedAt: now,
            wpm: 60,
            accuracy: 97,
            consistency: 90,
        });

        await createIncompleteSession(prisma, owner.user.id);

        await createCompletedSession(prisma, {
            userId: otherUser.user.id,
            completedAt: now,
            wpm: 100,
            accuracy: 100,
            consistency: 100,
        });

        const response = await request(app.getHttpServer())
            .get('/analytics/overview?range=all')
            .set('Authorization', `Bearer ${owner.accessToken}`)
            .expect(200);

        expect(response.body).toEqual({
            range: 'all',
            summary: {
                sessionCount: 1,
                recentWpm: 60,
                recentAccuracy: 97,
                consistency: 90,
            },
            trends: [
                {
                    completedAt: now.toISOString(),
                    wpm: 60,
                    accuracy: 97,
                },
            ],
        });
    });
});
