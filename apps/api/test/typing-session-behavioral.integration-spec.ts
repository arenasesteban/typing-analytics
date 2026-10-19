import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
    applyTypingInput,
    createTypingSession,
    deriveSessionBehavioralResult,
    type TypingInput,
} from '@typing-analytics/typing-core';
import { MongoClient } from 'mongodb';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { MongoService } from '../src/mongo/mongo.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EventDeliveryService } from '../src/session-events/event-delivery.service.js';
import type {
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
    TypingSessionHistoryDetailResponse,
} from '../src/typing-sessions/typing-sessions.types.js';
import { RateProtectionGuard } from '../src/security/rate-protection.guard.js';

import { authorizationHeader, registerTestUser } from './auth-test-helpers.js';

function correctInputs(text: string): TypingInput[] {
    return Array.from(text, (value, index) => ({
        type: 'insert',
        value,
        timestampMs: index * 100,
    }));
}

function correctedInputs(text: string): TypingInput[] {
    const characters = Array.from(text);
    const wrong = characters[0] === 'x' ? 'y' : 'x';

    return [
        { type: 'insert', value: wrong, timestampMs: 0 },
        { type: 'backspace', timestampMs: 50 },
        ...characters.map((value, index): TypingInput => ({
            type: 'insert',
            value,
            timestampMs: 100 + index * 100,
        })),
    ];
}

function deriveExpected(text: string, inputs: readonly TypingInput[]) {
    let session = createTypingSession(text);

    for (const input of inputs) {
        session = applyTypingInput(session, input);
    }

    return deriveSessionBehavioralResult(session);
}

describe('GET /typing-sessions/:id behavioral results', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let mongo: MongoService;
    let delivery: EventDeliveryService;
    let client: MongoClient;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideGuard(RateProtectionGuard)
            .useValue({
                canActivate: () => true,
            })
            .compile();

        app = moduleRef.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
        mongo = app.get(MongoService);
        delivery = app.get(EventDeliveryService);

        client = new MongoClient(process.env['MONGODB_URL']!);
        await client.connect();
    });

    async function cleanDatabases(): Promise<void> {
        await prisma.typingSession.deleteMany();
        await prisma.typingText.deleteMany();
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();

        await client.db(process.env['MONGODB_DB']!).collection('session_events').deleteMany({});
    }

    beforeEach(async () => {
        await cleanDatabases();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await cleanDatabases();
        await client.close();
        await app.close();
    });

    async function createSession(email: string) {
        const owner = await registerTestUser(app, email);

        const response = await request(app.getHttpServer())
            .post('/typing-sessions')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(201);

        return {
            owner,
            session: response.body as CreatedTypingSessionResponse,
        };
    }

    async function completeSession(
        token: string,
        session: CreatedTypingSessionResponse,
        inputs: readonly TypingInput[],
    ): Promise<CompletedTypingSessionResponse> {
        const response = await request(app.getHttpServer())
            .post(`/typing-sessions/${session.id}/complete`)
            .set('Authorization', authorizationHeader(token))
            .send({ inputs })
            .expect(200);

        return response.body as CompletedTypingSessionResponse;
    }

    async function getDetail(
        token: string,
        sessionId: string,
    ): Promise<TypingSessionHistoryDetailResponse> {
        const response = await request(app.getHttpServer())
            .get(`/typing-sessions/${sessionId}`)
            .set('Authorization', authorizationHeader(token))
            .expect(200);

        return response.body as TypingSessionHistoryDetailResponse;
    }

    it('returns pending without consulting MongoDB', async () => {
        const { owner, session } = await createSession('pending-detail@example.com');
        const inputs = correctInputs(session.typingText.text);

        await completeSession(owner.accessToken, session, inputs);

        const findSpy = vi.spyOn(mongo, 'findSessionEvents');

        const detail = await getDetail(owner.accessToken, session.id);

        expect(detail.behavioral).toEqual({ status: 'pending' });
        expect(findSpy).not.toHaveBeenCalled();
        expect(detail.typingText).toEqual(session.typingText);
    });

    it('returns the exact derived result after successful event delivery', async () => {
        const { owner, session } = await createSession('ready-detail@example.com');
        const inputs = correctInputs(session.typingText.text);

        const completed = await completeSession(owner.accessToken, session, inputs);
        await delivery.processPending();

        const detail = await getDetail(owner.accessToken, session.id);
        const expected = deriveExpected(session.typingText.text, inputs);

        expect(detail.behavioral).toEqual({
            status: 'ready',
            ...expected,
        });

        expect(detail.id).toBe(completed.id);
        expect(detail.typingText).toEqual(completed.typingText);
        expect(detail.durationMs).toBe(completed.durationMs);
        expect(detail.wpm).toBe(completed.wpm);
        expect(detail.rawWpm).toBe(completed.rawWpm);
        expect(detail.accuracy).toBe(completed.accuracy);
        expect(detail.consistency).toBe(completed.consistency);

        if (detail.behavioral.status !== 'ready') {
            throw new Error('Expected ready behavioral results');
        }

        expect(Object.keys(detail.behavioral).sort()).toEqual(['status', 'temporal']);

        expect(Object.keys(detail.behavioral.temporal).sort()).toEqual([
            'points',
            'sampleIntervalMs',
        ]);

        expect(detail.behavioral.temporal.sampleIntervalMs).toBe(1000);

        for (const point of detail.behavioral.temporal.points) {
            expect(Object.keys(point).sort()).toEqual(['elapsedMs', 'rawWpm', 'wpm']);
        }

        const sampleTimes = detail.behavioral.temporal.points.map((point) => point.elapsedMs);

        expect(new Set(sampleTimes).size).toBe(sampleTimes.length);

        const expectedSampleCount =
            completed.durationMs === 0 ? 1 : Math.ceil(completed.durationMs / 1000);

        expect(sampleTimes).toHaveLength(expectedSampleCount);
        expect(sampleTimes.at(-1)).toBe(completed.durationMs);

        const lastPoint = detail.behavioral.temporal.points.at(-1);

        expect(lastPoint).toBeDefined();
        expect(lastPoint?.elapsedMs).toBe(completed.durationMs);
        expect(lastPoint?.wpm).toBeCloseTo(completed.wpm, 6);
        expect(lastPoint?.rawWpm).toBeCloseTo(completed.rawWpm, 6);
    });

    it('preserves incorrect insertions and corrections', async () => {
        const { owner, session } = await createSession('corrections-detail@example.com');

        const inputs = correctedInputs(session.typingText.text);

        const completed = await completeSession(owner.accessToken, session, inputs);

        await delivery.processPending();

        const detail = await getDetail(owner.accessToken, session.id);
        const expected = deriveExpected(session.typingText.text, inputs);

        expect(completed.incorrectInputs).toBeGreaterThan(0);

        expect(detail.behavioral).toEqual({
            status: 'ready',
            ...expected,
        });

        if (detail.behavioral.status !== 'ready') {
            throw new Error('Expected ready behavioral results');
        }

        expect(Object.keys(detail.behavioral.temporal)).toEqual(['sampleIntervalMs', 'points']);

        expect(detail.behavioral.temporal.points.at(-1)?.wpm).toBeCloseTo(completed.wpm, 6);

        expect(detail.behavioral.temporal.points.at(-1)?.rawWpm).toBeCloseTo(completed.rawWpm, 6);
    });

    it('returns unavailable for an old completed session without events', async () => {
        const { owner, session } = await createSession('legacy-detail@example.com');

        await prisma.typingSession.update({
            where: { id: session.id },
            data: {
                durationMs: 1000,
                wpm: 12,
                rawWpm: 12,
                accuracy: 100,
                consistency: 100,
                totalInputs: 1,
                correctInputs: 1,
                incorrectInputs: 0,
                startedAt: new Date('2026-01-01T00:00:00.000Z'),
                completedAt: new Date('2026-01-01T00:00:01.000Z'),
                eventDeliveryStatus: 'UNAVAILABLE',
            },
        });

        const findSpy = vi.spyOn(mongo, 'findSessionEvents');

        const detail = await getDetail(owner.accessToken, session.id);

        expect(detail.behavioral).toEqual({ status: 'unavailable' });
        expect(detail.typingText).toEqual(session.typingText);
        expect(findSpy).not.toHaveBeenCalled();
    });

    it('returns 503 on MongoDB retrieval failure without changing readiness', async () => {
        const { owner, session } = await createSession('mongo-failure@example.com');

        await completeSession(owner.accessToken, session, correctInputs(session.typingText.text));
        await delivery.processPending();

        vi.spyOn(mongo, 'findSessionEvents').mockRejectedValueOnce(
            new Error('Simulated MongoDB outage'),
        );

        const response = await request(app.getHttpServer())
            .get(`/typing-sessions/${session.id}`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(503);

        expect(response.body.message).toBe('Behavioral results are temporarily unavailable');

        const persisted = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });

        expect(persisted.eventDeliveryStatus).toBe('READY');
    });

    it('returns 503 if a READY document is missing', async () => {
        const { owner, session } = await createSession('missing-document@example.com');

        await completeSession(owner.accessToken, session, correctInputs(session.typingText.text));
        await delivery.processPending();

        await client
            .db(process.env['MONGODB_DB']!)
            .collection<{ _id: string }>('session_events')
            .deleteOne({ _id: session.id });

        await request(app.getHttpServer())
            .get(`/typing-sessions/${session.id}`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(503);
    });

    it('returns 503 for an invalid stored event document', async () => {
        const { owner, session } = await createSession('corrupt-document@example.com');

        await completeSession(owner.accessToken, session, correctInputs(session.typingText.text));
        await delivery.processPending();

        await client
            .db(process.env['MONGODB_DB']!)
            .collection<{ _id: string; schemaVersion?: number; events?: unknown[] }>(
                'session_events',
            )
            .replaceOne(
                { _id: session.id },
                {
                    schemaVersion: 999,
                    events: [],
                },
            );

        await request(app.getHttpServer())
            .get(`/typing-sessions/${session.id}`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(503);
    });

    it('detects inconsistency between MongoDB events and PostgreSQL summary', async () => {
        const { owner, session } = await createSession('summary-mismatch@example.com');

        await completeSession(owner.accessToken, session, correctInputs(session.typingText.text));
        await delivery.processPending();

        const persisted = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });

        await prisma.typingSession.update({
            where: { id: session.id },
            data: { wpm: (persisted.wpm ?? 0) + 10 },
        });

        await request(app.getHttpServer())
            .get(`/typing-sessions/${session.id}`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(503);
    });

    it('rejects another user before consulting MongoDB', async () => {
        const { owner, session } = await createSession('private-owner@example.com');
        const attacker = await registerTestUser(app, 'other-user@example.com');

        await completeSession(owner.accessToken, session, correctInputs(session.typingText.text));
        await delivery.processPending();

        const findSpy = vi.spyOn(mongo, 'findSessionEvents');

        await request(app.getHttpServer())
            .get(`/typing-sessions/${session.id}`)
            .set('Authorization', authorizationHeader(attacker.accessToken))
            .expect(404);

        expect(findSpy).not.toHaveBeenCalled();
    });

    it('rejects missing authentication and invalid identifiers', async () => {
        const { owner, session } = await createSession('protected-detail@example.com');

        await request(app.getHttpServer()).get(`/typing-sessions/${session.id}`).expect(401);

        await request(app.getHttpServer())
            .get('/typing-sessions/not-a-uuid')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(400);

        await request(app.getHttpServer())
            .get('/typing-sessions/00000000-0000-4000-8000-000000000000')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(404);
    });

    it('keeps creation, completion and paginated history contracts compatible', async () => {
        const { owner, session } = await createSession('compatible-api@example.com');
        const completed = await completeSession(
            owner.accessToken,
            session,
            correctInputs(session.typingText.text),
        );

        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('typingText.text');
        expect(completed).toHaveProperty('wpm');
        expect(completed).toHaveProperty('accuracy');
        expect(completed).not.toHaveProperty('behavioral');

        const response = await request(app.getHttpServer())
            .get('/typing-sessions?page=1&pageSize=10')
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(200);

        expect(response.body.pagination.totalItems).toBe(1);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.items[0].id).toBe(session.id);
        expect(response.body.items[0]).not.toHaveProperty('behavioral');
    });

    it('never mixes behavioral events between users or sessions', async () => {
        const first = await createSession('isolated-a@example.com');
        const second = await createSession('isolated-b@example.com');

        const firstInputs = correctInputs(first.session.typingText.text);
        const secondInputs = correctedInputs(second.session.typingText.text);

        await completeSession(first.owner.accessToken, first.session, firstInputs);

        await completeSession(second.owner.accessToken, second.session, secondInputs);

        await delivery.processPending();

        const firstDetail = await getDetail(first.owner.accessToken, first.session.id);
        const secondDetail = await getDetail(second.owner.accessToken, second.session.id);

        expect(firstDetail.behavioral).toEqual({
            status: 'ready',
            ...deriveExpected(first.session.typingText.text, firstInputs),
        });

        expect(secondDetail.behavioral).toEqual({
            status: 'ready',
            ...deriveExpected(second.session.typingText.text, secondInputs),
        });

        if (
            firstDetail.behavioral.status !== 'ready' ||
            secondDetail.behavioral.status !== 'ready'
        ) {
            throw new Error('Expected ready behavioral results');
        }
    });
});
