import {
    applyTypingInput,
    createTypingSession,
    summarizeCompletedSession,
    type TypingSessionState,
} from '@typing-analytics/typing-core';
import { describe, expect, it } from 'vitest';

import {
    MAX_SESSION_EVENT_DOCUMENT_BYTES,
    MAX_STORED_SESSION_EVENTS,
} from './session-events.constants.js';
import {
    buildSessionEventDocument,
    replayStoredSessionEvents,
    SessionEventDocumentTooLargeError,
} from './session-events.mapper.js';
import { isSessionEventDocument } from './session-events.validator.js';

function createCompletedSession(): TypingSessionState {
    let session = createTypingSession('ab');

    session = applyTypingInput(session, {
        type: 'insert',
        value: 'x',
        timestampMs: 100,
    });

    session = applyTypingInput(session, {
        type: 'backspace',
        timestampMs: 200,
    });

    session = applyTypingInput(session, {
        type: 'insert',
        value: 'a',
        timestampMs: 300,
    });

    session = applyTypingInput(session, {
        type: 'insert',
        value: 'b',
        timestampMs: 400,
    });

    return session;
}

describe('Session events mapper', () => {
    it('serializes only the required event fields', () => {
        const session = createCompletedSession();

        const document = buildSessionEventDocument('session-1', session);

        expect(document).toEqual({
            _id: 'session-1',
            schemaVersion: 1,
            events: [
                {
                    sequence: 0,
                    type: 'insert',
                    position: 0,
                    enteredCharacter: 'x',
                    timestampMs: 100,
                },
                {
                    sequence: 1,
                    type: 'backspace',
                    position: 0,
                    timestampMs: 200,
                },
                {
                    sequence: 2,
                    type: 'insert',
                    position: 0,
                    enteredCharacter: 'a',
                    timestampMs: 300,
                },
                {
                    sequence: 3,
                    type: 'insert',
                    position: 1,
                    enteredCharacter: 'b',
                    timestampMs: 400,
                },
            ],
        });

        expect(isSessionEventDocument(document)).toBe(true);
    });

    it('reconstructs a session without changing its metrics', () => {
        const original = createCompletedSession();
        const document = buildSessionEventDocument('session-1', original);

        const reconstructed = replayStoredSessionEvents('ab', document);

        expect(reconstructed.status).toBe('completed');
        expect(reconstructed.events).toEqual(original.events);

        expect(summarizeCompletedSession(reconstructed)).toEqual(
            summarizeCompletedSession(original),
        );
    });

    it('does not mutate the original typing session', () => {
        const session = createCompletedSession();
        const originalEvents = session.events.map((event) => ({
            ...event,
        }));

        buildSessionEventDocument('session-1', session);

        expect(session.events).toEqual(originalEvents);
    });

    it('rejects an unfinished typing session', () => {
        const session = createTypingSession('abc');

        expect(() => buildSessionEventDocument('session-1', session)).toThrow(
            'Only completed typing sessions can be persisted',
        );
    });

    it('rejects more events than the storage limit', () => {
        const completed = createCompletedSession();
        const firstEvent = completed.events[0];

        if (firstEvent === undefined) {
            throw new Error('Expected at least one event');
        }

        const oversized: TypingSessionState = {
            ...completed,
            events: Array.from({ length: MAX_STORED_SESSION_EVENTS + 1 }, () => firstEvent),
        };

        expect(() => buildSessionEventDocument('session-1', oversized)).toThrow(
            SessionEventDocumentTooLargeError,
        );
    });

    it('rejects documents exceeding the byte limit', () => {
        const session = createCompletedSession();
        const oversizedId = 'x'.repeat(MAX_SESSION_EVENT_DOCUMENT_BYTES);

        expect(() => buildSessionEventDocument(oversizedId, session)).toThrow(
            SessionEventDocumentTooLargeError,
        );
    });

    it('rejects event histories that do not complete the target', () => {
        const document = buildSessionEventDocument('session-1', createCompletedSession());

        expect(() => replayStoredSessionEvents('abc', document)).toThrow(
            'Stored typing events do not complete the session',
        );
    });

    it('rejects structurally valid but inconsistent transitions', () => {
        const document = {
            _id: 'session-1',
            schemaVersion: 1 as const,
            events: [
                {
                    sequence: 0,
                    type: 'backspace' as const,
                    position: 0,
                    timestampMs: 100,
                },
                {
                    sequence: 1,
                    type: 'insert' as const,
                    position: 0,
                    enteredCharacter: 'a',
                    timestampMs: 200,
                },
            ],
        };

        expect(isSessionEventDocument(document)).toBe(true);

        expect(() => replayStoredSessionEvents('a', document)).toThrow(
            'Stored typing event sequence is inconsistent',
        );
    });
});
