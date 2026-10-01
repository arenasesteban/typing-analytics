import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
    applyTypingInput,
    createTypingSession,
    summarizeCompletedSession,
    type TypingInput,
} from '@typing-analytics/typing-core';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MAX_COMPLETION_INPUTS } from '../src/typing-sessions/typing-sessions.constants.js';
import type {
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
} from '../src/typing-sessions/typing-sessions.types.js';

const EXPECTED_TYPING_TEXT =
    'typing analytics turns each practice session into clear feedback about speed accuracy and rhythm';

function buildCompletionInputs(
    targetText: string,
    startTimestampMs = 1_000,
    stepMs = 100,
): TypingInput[] {
    return Array.from(targetText).map((value, index) => ({
        type: 'insert',
        value,
        timestampMs: startTimestampMs + index * stepMs,
    }));
}

function buildExpectedSummary(targetText: string, inputs: readonly TypingInput[]) {
    let session = createTypingSession(targetText);

    for (const input of inputs) {
        session = applyTypingInput(session, input);
    }

    return summarizeCompletedSession(session);
}

describe('POST /typing-sessions/:id/complete', () => {
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

    async function createPersistentSession(): Promise<CreatedTypingSessionResponse> {
        const response = await request(app.getHttpServer()).post('/typing-sessions').expect(201);

        return response.body as CreatedTypingSessionResponse;
    }

    it('replays the persisted target text and stores the server-calculated summary', async () => {
        const createdSession = await createPersistentSession();
        const inputs = buildCompletionInputs(createdSession.typingText.text);
        const expectedSummary = buildExpectedSummary(createdSession.typingText.text, inputs);

        const requestStartedAt = Date.now();

        const response = await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs,
            })
            .expect(200);

        const requestCompletedAt = Date.now();

        const body = response.body as CompletedTypingSessionResponse;

        expect(body.id).toBe(createdSession.id);
        expect(body.typingText).toEqual(createdSession.typingText);

        expect(body.durationMs).toBe(expectedSummary.durationMs);
        expect(body.wpm).toBeCloseTo(expectedSummary.wpm);
        expect(body.rawWpm).toBeCloseTo(expectedSummary.rawWpm);
        expect(body.accuracy).toBeCloseTo(expectedSummary.accuracy);
        expect(body.consistency).toBeCloseTo(expectedSummary.consistency);
        expect(body.totalInputs).toBe(expectedSummary.totalInputs);
        expect(body.correctInputs).toBe(expectedSummary.correctInputs);
        expect(body.incorrectInputs).toBe(expectedSummary.incorrectInputs);

        const persistedSession = await prisma.typingSession.findUnique({
            where: {
                id: createdSession.id,
            },
        });

        expect(persistedSession).not.toBeNull();

        if (
            persistedSession === null ||
            persistedSession.startedAt === null ||
            persistedSession.completedAt === null
        ) {
            throw new Error('Expected completed session persistence');
        }

        expect(persistedSession.durationMs).toBe(expectedSummary.durationMs);
        expect(persistedSession.wpm).toBeCloseTo(expectedSummary.wpm);
        expect(persistedSession.rawWpm).toBeCloseTo(expectedSummary.rawWpm);
        expect(persistedSession.accuracy).toBeCloseTo(expectedSummary.accuracy);
        expect(persistedSession.consistency).toBeCloseTo(expectedSummary.consistency);
        expect(persistedSession.totalInputs).toBe(expectedSummary.totalInputs);
        expect(persistedSession.correctInputs).toBe(expectedSummary.correctInputs);
        expect(persistedSession.incorrectInputs).toBe(expectedSummary.incorrectInputs);

        expect(persistedSession.completedAt.getTime()).toBeGreaterThanOrEqual(requestStartedAt);
        expect(persistedSession.completedAt.getTime()).toBeLessThanOrEqual(requestCompletedAt);

        expect(persistedSession.completedAt.getTime() - persistedSession.startedAt.getTime()).toBe(
            expectedSummary.durationMs,
        );

        expect(new Date(body.startedAt).getTime()).toBe(persistedSession.startedAt.getTime());
        expect(new Date(body.completedAt).getTime()).toBe(persistedSession.completedAt.getTime());
    });

    it('returns 404 for an unknown session', async () => {
        const inputs = buildCompletionInputs(EXPECTED_TYPING_TEXT);

        await request(app.getHttpServer())
            .post(`/typing-sessions/${randomUUID()}/complete`)
            .send({
                inputs,
            })
            .expect(404);
    });

    it('rejects a second completion without mutating the persisted result', async () => {
        const createdSession = await createPersistentSession();
        const inputs = buildCompletionInputs(createdSession.typingText.text);

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs,
            })
            .expect(200);

        const firstResult = await prisma.typingSession.findUniqueOrThrow({
            where: {
                id: createdSession.id,
            },
        });

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs,
            })
            .expect(409);

        const secondResult = await prisma.typingSession.findUniqueOrThrow({
            where: {
                id: createdSession.id,
            },
        });

        expect(secondResult).toEqual(firstResult);
    });

    it('allows only one successful concurrent completion', async () => {
        const createdSession = await createPersistentSession();
        const inputs = buildCompletionInputs(createdSession.typingText.text);

        const responses = await Promise.all([
            request(app.getHttpServer())
                .post(`/typing-sessions/${createdSession.id}/complete`)
                .send({
                    inputs,
                }),
            request(app.getHttpServer())
                .post(`/typing-sessions/${createdSession.id}/complete`)
                .send({
                    inputs,
                }),
        ]);

        const statuses = responses.map((response) => response.status).sort();

        expect(statuses).toEqual([200, 409]);

        const successfulResponse = responses.find((response) => response.status === 200);

        expect(successfulResponse).toBeDefined();

        const persistedSession = await prisma.typingSession.findUniqueOrThrow({
            where: {
                id: createdSession.id,
            },
        });

        expect(persistedSession.completedAt).not.toBeNull();
    });

    it('rejects malformed completion payloads', async () => {
        const createdSession = await createPersistentSession();

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs: 'not-an-array',
            })
            .expect(400);
    });

    it('rejects client-provided derived metrics', async () => {
        const createdSession = await createPersistentSession();
        const inputs = buildCompletionInputs(createdSession.typingText.text);

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs,
                wpm: 9999,
                accuracy: 100,
            })
            .expect(400);

        const persistedSession = await prisma.typingSession.findUniqueOrThrow({
            where: {
                id: createdSession.id,
            },
        });

        expect(persistedSession.completedAt).toBeNull();
    });

    it('rejects invalid typing transitions', async () => {
        const createdSession = await createPersistentSession();

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs: [
                    {
                        type: 'backspace',
                        timestampMs: 100,
                    },
                ],
            })
            .expect(400);
    });

    it('rejects decreasing input timestamps', async () => {
        const createdSession = await createPersistentSession();

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs: [
                    {
                        type: 'insert',
                        value: createdSession.typingText.text[0],
                        timestampMs: 200,
                    },
                    {
                        type: 'insert',
                        value: createdSession.typingText.text[1],
                        timestampMs: 100,
                    },
                ],
            })
            .expect(400);
    });

    it('rejects an interaction that does not complete the target text', async () => {
        const createdSession = await createPersistentSession();

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs: [
                    {
                        type: 'insert',
                        value: createdSession.typingText.text[0],
                        timestampMs: 100,
                    },
                ],
            })
            .expect(400);
    });

    it('rejects explicitly oversized completion payloads', async () => {
        const createdSession = await createPersistentSession();

        const inputs = Array.from(
            {
                length: MAX_COMPLETION_INPUTS + 1,
            },
            () => ({
                type: 'backspace',
                timestampMs: 0,
            }),
        );

        await request(app.getHttpServer())
            .post(`/typing-sessions/${createdSession.id}/complete`)
            .send({
                inputs,
            })
            .expect(413);
    });

    it('rejects malformed session identifiers', async () => {
        await request(app.getHttpServer())
            .post('/typing-sessions/not-a-uuid/complete')
            .send({
                inputs: [
                    {
                        type: 'insert',
                        value: 'a',
                        timestampMs: 0,
                    },
                ],
            })
            .expect(400);
    });
});
