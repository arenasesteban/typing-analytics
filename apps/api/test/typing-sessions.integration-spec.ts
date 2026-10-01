import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { CreatedTypingSessionResponse } from '../src/typing-sessions/typing-sessions.types.js';

const EXPECTED_TYPING_TEXT =
    'typing analytics turns each practice session into clear feedback about speed accuracy and rhythm';

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
    });

    afterAll(async () => {
        await prisma.typingSession.deleteMany();
        await prisma.typingText.deleteMany();
        await app.close();
    });

    it('creates a persisted server-owned typing session', async () => {
        const response = await request(app.getHttpServer()).post('/typing-sessions').expect(201);

        const body = response.body as CreatedTypingSessionResponse;

        expect(body.id).toEqual(expect.any(String));
        expect(body.typingText).toEqual({
            id: expect.any(String),
            text: EXPECTED_TYPING_TEXT,
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
                text: EXPECTED_TYPING_TEXT,
            },
        });
    });

    it('creates independent sessions while reusing the persisted typing text', async () => {
        const firstResponse = await request(app.getHttpServer())
            .post('/typing-sessions')
            .expect(201);

        const secondResponse = await request(app.getHttpServer())
            .post('/typing-sessions')
            .expect(201);

        const firstBody = firstResponse.body as CreatedTypingSessionResponse;
        const secondBody = secondResponse.body as CreatedTypingSessionResponse;

        expect(firstBody.id).not.toBe(secondBody.id);
        expect(firstBody.typingText).toEqual(secondBody.typingText);

        expect(await prisma.typingSession.count()).toBe(2);
        expect(
            await prisma.typingText.count({
                where: {
                    text: EXPECTED_TYPING_TEXT,
                },
            }),
        ).toBe(1);
    });

    it('rejects client-controlled persistent session data', async () => {
        await request(app.getHttpServer())
            .post('/typing-sessions')
            .send({
                id: 'client-generated-id',
                text: 'client-controlled text',
            })
            .expect(400);

        expect(await prisma.typingSession.count()).toBe(0);
        expect(await prisma.typingText.count()).toBe(0);
    });
});
