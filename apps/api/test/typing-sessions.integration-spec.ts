import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DEFAULT_TYPING_WORD_COUNT, ENGLISH_WORD_CORPUS } from '@typing-analytics/typing-core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { CreatedTypingSessionResponse } from '../src/typing-sessions/typing-sessions.types.js';
import { authorizationHeader, registerTestUser } from './auth-test-helpers.js';

const EXPECTED_CONTROLLED_TEXT = Array.from(
    { length: DEFAULT_TYPING_WORD_COUNT },
    () => ENGLISH_WORD_CORPUS[0],
).join(' ');

describe('POST /typing-sessions', () => {
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
        await prisma.typingSession.deleteMany();
        await prisma.typingText.deleteMany();
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.typingSession.deleteMany();
        await prisma.typingText.deleteMany();
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();
        await app.close();
    });

    it('rejects unauthenticated persistent session creation', async () => {
        await request(app.getHttpServer()).post('/typing-sessions').expect(401);

        expect(await prisma.typingSession.count()).toBe(0);
    });

    it('generates and persists a session owned by the authenticated user', async () => {
        const owner = await registerTestUser(app, 'owner@example.com');

        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const response = await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(201);

        const body = response.body as CreatedTypingSessionResponse;

        expect(randomSpy).toHaveBeenCalledTimes(DEFAULT_TYPING_WORD_COUNT);

        expect(body.id).toEqual(expect.any(String));

        expect(body.typingText).toEqual({
            id: expect.any(String),
            text: EXPECTED_CONTROLLED_TEXT,
        });

        const persistedSession = await prisma.typingSession.findUnique({
            where: {
                id: body.id,
            },
            include: {
                typingText: true,
            },
        });

        expect(persistedSession).not.toBeNull();

        expect(persistedSession).toMatchObject({
            id: body.id,
            userId: owner.user.id,
            typingTextId: body.typingText.id,
            durationMs: null,
            wpm: null,
            rawWpm: null,
            accuracy: null,
            consistency: null,
            totalInputs: null,
            correctInputs: null,
            incorrectInputs: null,
            startedAt: null,
            completedAt: null,
            typingText: {
                id: body.typingText.id,
                text: EXPECTED_CONTROLLED_TEXT,
            },
        });
    });

    it('executes target generation for every authenticated persistent session', async () => {
        const owner = await registerTestUser(app, 'owner@example.com');

        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const firstResponse = await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(201);

        const secondResponse = await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(201);

        const firstBody = firstResponse.body as CreatedTypingSessionResponse;

        const secondBody = secondResponse.body as CreatedTypingSessionResponse;

        expect(randomSpy).toHaveBeenCalledTimes(DEFAULT_TYPING_WORD_COUNT * 2);

        expect(firstBody.id).not.toBe(secondBody.id);

        expect(firstBody.typingText.text).toBe(EXPECTED_CONTROLLED_TEXT);

        expect(secondBody.typingText.text).toBe(EXPECTED_CONTROLLED_TEXT);

        expect(firstBody.typingText).toEqual(secondBody.typingText);

        const sessions = await prisma.typingSession.findMany({
            orderBy: {
                id: 'asc',
            },
        });

        expect(sessions).toHaveLength(2);

        expect(sessions.every((session) => session.userId === owner.user.id)).toBe(true);

        expect(
            await prisma.typingText.count({
                where: {
                    text: EXPECTED_CONTROLLED_TEXT,
                },
            }),
        ).toBe(1);
    });

    it('rejects client-controlled ownership data', async () => {
        const owner = await registerTestUser(app, 'owner@example.com');

        const otherUser = await registerTestUser(app, 'other@example.com');

        await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .send({
                userId: otherUser.user.id,
            })
            .expect(400);

        expect(await prisma.typingSession.count()).toBe(0);
        expect(await prisma.typingText.count()).toBe(0);
    });
});
