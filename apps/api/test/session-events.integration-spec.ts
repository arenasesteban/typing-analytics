import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoClient } from 'mongodb';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { MongoService } from '../src/mongo/mongo.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EventDeliveryService } from '../src/session-events/event-delivery.service.js';
import { replayStoredSessionEvents } from '../src/session-events/session-events.mapper.js';
import { isSessionEventDocument } from '../src/session-events/session-events.validator.js';
import type {
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
} from '../src/typing-sessions/typing-sessions.types.js';
import { authorizationHeader, registerTestUser } from './auth-test-helpers.js';

function inputsForText(text: string) {
    return Array.from(text, (value, index) => ({
        type: 'insert' as const,
        value,
        timestampMs: index * 100,
    }));
}

describe('Validated session event persistence', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let mongo: MongoService;
    let delivery: EventDeliveryService;
    let cleanupClient: MongoClient;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
        mongo = app.get(MongoService);
        delivery = app.get(EventDeliveryService);

        cleanupClient = new MongoClient(process.env['MONGODB_URL']!);
        await cleanupClient.connect();
    });

    async function cleanDatabases(): Promise<void> {
        await prisma.typingSession.deleteMany();
        await prisma.typingText.deleteMany();
        await prisma.refreshSession.deleteMany();
        await prisma.user.deleteMany();

        await cleanupClient
            .db(process.env['MONGODB_DB']!)
            .collection('session_events')
            .deleteMany({});
    }

    beforeEach(async () => {
        await cleanDatabases();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await cleanDatabases();
        await cleanupClient.close();
        await app.close();
    });

    async function createOwnedSession(email: string) {
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

    async function completeOwnedSession(
        owner: Awaited<ReturnType<typeof registerTestUser>>,
        session: CreatedTypingSessionResponse,
    ) {
        const response = await request(app.getHttpServer())
            .post(`/typing-sessions/${session.id}/complete`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .send({ inputs: inputsForText(session.typingText.text) })
            .expect(200);

        return response.body as CompletedTypingSessionResponse;
    }

    it('commits summary and durable outbox atomically before Mongo delivery', async () => {
        const { owner, session } = await createOwnedSession('durable@example.com');

        await completeOwnedSession(owner, session);

        const persisted = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });
        const outbox = await prisma.sessionEventOutbox.findUniqueOrThrow({
            where: { sessionId: session.id },
        });

        expect(persisted.eventDeliveryStatus).toBe('PENDING');
        expect(persisted.completedAt).not.toBeNull();
        expect(isSessionEventDocument(outbox.payload)).toBe(true);
        expect(await mongo.findSessionEvents(session.id)).toBeNull();
    });

    it('delivers one reconstructible document and marks its session READY', async () => {
        const { owner, session } = await createOwnedSession('ready@example.com');
        const completed = await completeOwnedSession(owner, session);

        await delivery.processPending();

        const persisted = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });
        const document = await mongo.findSessionEvents(session.id);

        expect(persisted.eventDeliveryStatus).toBe('READY');
        expect(await prisma.sessionEventOutbox.count()).toBe(0);
        expect(document).not.toBeNull();
        expect(document?.schemaVersion).toBe(1);
        expect(document?.events).toHaveLength(Array.from(session.typingText.text).length);

        if (document === null) throw new Error('Expected a MongoDB event document');

        const replayed = replayStoredSessionEvents(session.typingText.text, document);

        expect(replayed.status).toBe('completed');
        expect(replayed.events).toHaveLength(document.events.length);
        expect(completed.totalInputs).toBe(document.events.length);
    });

    it('preserves wrong insertions, backspaces, position and event order', async () => {
        const { owner, session } = await createOwnedSession('correction@example.com');
        const target = Array.from(session.typingText.text);
        const wrong = target[0] === 'x' ? 'y' : 'x';

        const inputs = [
            { type: 'insert', value: wrong, timestampMs: 0 },
            { type: 'backspace', timestampMs: 50 },
            ...target.map((value, index) => ({
                type: 'insert',
                value,
                timestampMs: 100 + index * 100,
            })),
        ];

        await request(app.getHttpServer())
            .post(`/typing-sessions/${session.id}/complete`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .send({ inputs })
            .expect(200);

        await delivery.processPending();

        const document = await mongo.findSessionEvents(session.id);
        expect(document).not.toBeNull();

        if (document === null) throw new Error('Expected a MongoDB event document');

        expect(document.events.slice(0, 3)).toEqual([
            {
                sequence: 0,
                type: 'insert',
                position: 0,
                enteredCharacter: wrong,
                timestampMs: 0,
            },
            {
                sequence: 1,
                type: 'backspace',
                position: 0,
                timestampMs: 50,
            },
            {
                sequence: 2,
                type: 'insert',
                position: 0,
                enteredCharacter: target[0],
                timestampMs: 100,
            },
        ]);

        const replayed = replayStoredSessionEvents(session.typingText.text, document);
        expect(replayed.status).toBe('completed');
        expect(replayed.events).toHaveLength(inputs.length);
    });

    it('keeps a recoverable outbox when MongoDB fails and later retries', async () => {
        const { owner, session } = await createOwnedSession('retry@example.com');
        await completeOwnedSession(owner, session);

        const writeSpy = vi
            .spyOn(mongo, 'writeSessionEvents')
            .mockRejectedValueOnce(new Error('Simulated MongoDB outage'));

        await delivery.processPending();

        const pending = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });
        const outbox = await prisma.sessionEventOutbox.findUniqueOrThrow({
            where: { sessionId: session.id },
        });

        expect(pending.eventDeliveryStatus).toBe('PENDING');
        expect(outbox.attempts).toBe(1);
        expect(outbox.leaseToken).toBeNull();

        writeSpy.mockRestore();

        await prisma.sessionEventOutbox.update({
            where: { sessionId: session.id },
            data: { nextAttemptAt: new Date(0) },
        });

        await delivery.processPending();

        const recovered = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });

        expect(recovered.eventDeliveryStatus).toBe('READY');
        expect(await mongo.findSessionEvents(session.id)).not.toBeNull();
        expect(await prisma.sessionEventOutbox.count()).toBe(0);
    });

    it('does not duplicate documents after a successful Mongo write is replayed', async () => {
        const { owner, session } = await createOwnedSession('idempotent@example.com');
        await completeOwnedSession(owner, session);

        const outbox = await prisma.sessionEventOutbox.findUniqueOrThrow({
            where: { sessionId: session.id },
        });

        if (!isSessionEventDocument(outbox.payload)) {
            throw new Error('Expected a valid outbox document');
        }

        await mongo.writeSessionEvents(outbox.payload);
        await delivery.processPending();

        const documents = await cleanupClient
            .db(process.env['MONGODB_DB']!)
            .collection<{ _id: string }>('session_events')
            .countDocuments({ _id: session.id });

        expect(documents).toBe(1);
        expect(await prisma.sessionEventOutbox.count()).toBe(0);
    });

    it('recovers an expired worker lease', async () => {
        const { owner, session } = await createOwnedSession('lease@example.com');
        await completeOwnedSession(owner, session);

        await prisma.sessionEventOutbox.update({
            where: { sessionId: session.id },
            data: {
                leaseToken: '00000000-0000-4000-8000-000000000001',
                leasedUntil: new Date(0),
            },
        });

        await delivery.processPending();

        const persisted = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });

        expect(persisted.eventDeliveryStatus).toBe('READY');
    });

    it('rejects unauthorized and invalid completion without creating an outbox', async () => {
        const { owner, session } = await createOwnedSession('owner@example.com');
        const attacker = await registerTestUser(app, 'attacker@example.com');

        await request(app.getHttpServer())
            .post(`/typing-sessions/${session.id}/complete`)
            .set('Authorization', authorizationHeader(attacker.accessToken))
            .send({ inputs: inputsForText(session.typingText.text) })
            .expect(404);

        await request(app.getHttpServer())
            .post(`/typing-sessions/${session.id}/complete`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .send({ inputs: [] })
            .expect(400);

        expect(await prisma.sessionEventOutbox.count()).toBe(0);
        expect(await mongo.findSessionEvents(session.id)).toBeNull();
    });

    it('rejects duplicate completions without creating duplicate outbox records', async () => {
        const { owner, session } = await createOwnedSession('duplicate@example.com');
        const inputs = inputsForText(session.typingText.text);

        const responses = await Promise.all([
            request(app.getHttpServer())
                .post(`/typing-sessions/${session.id}/complete`)
                .set('Authorization', authorizationHeader(owner.accessToken))
                .send({ inputs }),
            request(app.getHttpServer())
                .post(`/typing-sessions/${session.id}/complete`)
                .set('Authorization', authorizationHeader(owner.accessToken))
                .send({ inputs }),
        ]);

        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

        expect(
            await prisma.sessionEventOutbox.count({
                where: { sessionId: session.id },
            }),
        ).toBe(1);

        await delivery.processPending();

        const documents = await cleanupClient
            .db(process.env['MONGODB_DB']!)
            .collection<{ _id: string }>('session_events')
            .countDocuments({ _id: session.id });

        expect(documents).toBe(1);
    });

    it('preserves legacy sessions without claiming events are ready', async () => {
        const { owner, session } = await createOwnedSession('legacy@example.com');

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
                startedAt: new Date('2026-01-01T00:00:00Z'),
                completedAt: new Date('2026-01-01T00:00:01Z'),
            },
        });

        const history = await request(app.getHttpServer())
            .get(`/typing-sessions/${session.id}`)
            .set('Authorization', authorizationHeader(owner.accessToken))
            .expect(200);

        expect(history.body).toHaveProperty('id', session.id);

        const persisted = await prisma.typingSession.findUniqueOrThrow({
            where: { id: session.id },
        });

        expect(persisted.eventDeliveryStatus).toBe('UNAVAILABLE');
        expect(await prisma.sessionEventOutbox.count()).toBe(0);
    });
});
