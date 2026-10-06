import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthSessionResponse } from '../src/auth/auth.types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MAX_HISTORY_PAGE_SIZE } from '../src/typing-sessions/typing-sessions.constants.js';
import type {
    TypingSessionHistoryDetailResponse,
    TypingSessionHistoryResponse,
} from '../src/typing-sessions/typing-sessions.types.js';
import { authorizationHeader, registerTestUser } from './auth-test-helpers.js';

describe('private typing session history', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let owner: AuthSessionResponse;
    let otherUser: AuthSessionResponse;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
    });

    beforeEach(async () => {
        await prisma.typingSession.deleteMany();
        await prisma.typingText.deleteMany();
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();

        owner = await registerTestUser(app, 'owner@example.com');

        otherUser = await registerTestUser(app, 'other@example.com');
    });

    afterAll(async () => {
        await prisma.typingSession.deleteMany();
        await prisma.typingText.deleteMany();
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();
        await app.close();
    });

    function getAs(accessToken: string, path: string) {
        return request(app.getHttpServer())
            .get(path)
            .set('Authorization', authorizationHeader(accessToken));
    }

    async function seedCompletedSession(
        userId: string,
        label: string,
        completedAt: Date,
        metricSeed = 0,
    ) {
        const typingText = await prisma.typingText.create({
            data: {
                text: `history target ${label} ${randomUUID()}`,
            },
        });

        const durationMs = 60_000 + metricSeed * 1_000;

        return prisma.typingSession.create({
            data: {
                userId,
                typingTextId: typingText.id,
                durationMs,
                wpm: 50 + metricSeed,
                rawWpm: 55 + metricSeed,
                accuracy: 95 - metricSeed * 0.1,
                consistency: 90 - metricSeed * 0.1,
                totalInputs: 100 + metricSeed,
                correctInputs: 95 + metricSeed,
                incorrectInputs: 5,
                startedAt: new Date(completedAt.getTime() - durationMs),
                completedAt,
            },
            include: {
                typingText: true,
            },
        });
    }

    async function seedIncompleteSession(userId: string, label: string) {
        const typingText = await prisma.typingText.create({
            data: {
                text: `incomplete target ${label} ${randomUUID()}`,
            },
        });

        return prisma.typingSession.create({
            data: {
                userId,
                typingTextId: typingText.id,
            },
        });
    }

    it('rejects unauthenticated history access', async () => {
        await request(app.getHttpServer()).get('/typing-sessions').expect(401);
    });

    it('returns an empty paginated history for a user without completed sessions', async () => {
        const response = await getAs(owner.accessToken, '/typing-sessions').expect(200);

        const body = response.body as TypingSessionHistoryResponse;

        expect(body).toEqual({
            items: [],
            pagination: {
                page: 1,
                pageSize: 20,
                totalItems: 0,
                totalPages: 0,
            },
        });
    });

    it('returns only the authenticated user completed sessions in reverse chronological order', async () => {
        const oldest = await seedCompletedSession(
            owner.user.id,
            'oldest',
            new Date('2026-10-01T12:00:00.000Z'),
            1,
        );

        const middle = await seedCompletedSession(
            owner.user.id,
            'middle',
            new Date('2026-10-02T12:00:00.000Z'),
            2,
        );

        const newest = await seedCompletedSession(
            owner.user.id,
            'newest',
            new Date('2026-10-03T12:00:00.000Z'),
            3,
        );

        await seedCompletedSession(
            otherUser.user.id,
            'other-user',
            new Date('2026-10-04T12:00:00.000Z'),
            4,
        );

        await seedIncompleteSession(owner.user.id, 'incomplete');

        const response = await getAs(owner.accessToken, '/typing-sessions').expect(200);

        const body = response.body as TypingSessionHistoryResponse;

        expect(body.items.map((session) => session.id)).toEqual([newest.id, middle.id, oldest.id]);

        expect(body.pagination).toEqual({
            page: 1,
            pageSize: 20,
            totalItems: 3,
            totalPages: 1,
        });

        expect(body.items[0]).toMatchObject({
            id: newest.id,
            durationMs: newest.durationMs,
            wpm: newest.wpm,
            rawWpm: newest.rawWpm,
            accuracy: newest.accuracy,
            consistency: newest.consistency,
            totalInputs: newest.totalInputs,
            correctInputs: newest.correctInputs,
            incorrectInputs: newest.incorrectInputs,
            startedAt: newest.startedAt?.toISOString(),
            completedAt: newest.completedAt?.toISOString(),
        });

        expect(body.items[0]).not.toHaveProperty('typingText');
    });

    it('returns the expected page and pagination metadata', async () => {
        const sessions = await Promise.all([
            seedCompletedSession(owner.user.id, 'page-1', new Date('2026-10-01T12:00:00.000Z'), 1),
            seedCompletedSession(owner.user.id, 'page-2', new Date('2026-10-02T12:00:00.000Z'), 2),
            seedCompletedSession(owner.user.id, 'page-3', new Date('2026-10-03T12:00:00.000Z'), 3),
            seedCompletedSession(owner.user.id, 'page-4', new Date('2026-10-04T12:00:00.000Z'), 4),
            seedCompletedSession(owner.user.id, 'page-5', new Date('2026-10-05T12:00:00.000Z'), 5),
        ]);

        const response = await getAs(
            owner.accessToken,
            '/typing-sessions?page=2&pageSize=2',
        ).expect(200);

        const body = response.body as TypingSessionHistoryResponse;

        expect(body.items.map((session) => session.id)).toEqual([sessions[2].id, sessions[1].id]);

        expect(body.pagination).toEqual({
            page: 2,
            pageSize: 2,
            totalItems: 5,
            totalPages: 3,
        });
    });

    it.each([
        'page=0',
        'page=-1',
        'page=1.5',
        'page=abc',
        'page=9999999999999999',
        'pageSize=0',
        `pageSize=${MAX_HISTORY_PAGE_SIZE + 1}`,
        'pageSize=abc',
        'unexpected=value',
    ])('rejects invalid history query parameters: %s', async (query) => {
        await getAs(owner.accessToken, `/typing-sessions?${query}`).expect(400);
    });

    it('returns the persisted result and concrete target for an owned completed session', async () => {
        const completedAt = new Date('2026-10-05T18:00:00.000Z');

        const session = await seedCompletedSession(owner.user.id, 'detail', completedAt, 6);

        if (session.startedAt === null || session.completedAt === null) {
            throw new Error('Expected seeded session to be completed');
        }

        const response = await getAs(owner.accessToken, `/typing-sessions/${session.id}`).expect(
            200,
        );

        const body = response.body as TypingSessionHistoryDetailResponse;

        expect(body).toEqual({
            id: session.id,
            typingText: {
                id: session.typingText.id,
                text: session.typingText.text,
            },
            durationMs: session.durationMs,
            wpm: session.wpm,
            rawWpm: session.rawWpm,
            accuracy: session.accuracy,
            consistency: session.consistency,
            totalInputs: session.totalInputs,
            correctInputs: session.correctInputs,
            incorrectInputs: session.incorrectInputs,
            startedAt: session.startedAt.toISOString(),
            completedAt: session.completedAt.toISOString(),
        });
    });

    it('does not expose a session owned by another user', async () => {
        const session = await seedCompletedSession(
            otherUser.user.id,
            'private',
            new Date('2026-10-05T18:00:00.000Z'),
        );

        await getAs(owner.accessToken, `/typing-sessions/${session.id}`).expect(404);
    });

    it('does not expose an incomplete owned session as history detail', async () => {
        const session = await seedIncompleteSession(owner.user.id, 'private-incomplete');

        await getAs(owner.accessToken, `/typing-sessions/${session.id}`).expect(404);
    });

    it('returns 404 for an unknown completed-session identifier', async () => {
        await getAs(owner.accessToken, `/typing-sessions/${randomUUID()}`).expect(404);
    });

    it('rejects malformed session identifiers', async () => {
        await getAs(owner.accessToken, '/typing-sessions/not-a-valid-uuid').expect(400);
    });
});
