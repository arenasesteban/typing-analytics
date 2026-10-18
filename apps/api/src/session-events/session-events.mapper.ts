import {
    applyTypingInput,
    createTypingSession,
    type TypingInput,
    type TypingSessionState,
} from '@typing-analytics/typing-core';
import {
    MAX_SESSION_EVENT_DOCUMENT_BYTES,
    MAX_STORED_SESSION_EVENTS,
    SESSION_EVENT_SCHEMA_VERSION,
} from './session-events.constants.js';
import type { SessionEventDocument, StoredSessionEvent } from './session-events.types.js';
import { isSessionEventDocument } from './session-events.validator.js';

export class SessionEventDocumentTooLargeError extends RangeError {
    constructor(message: string) {
        super(message);
        this.name = 'SessionEventDocumentTooLargeError';
    }
}

export function buildSessionEventDocument(
    sessionId: string,
    session: TypingSessionState,
): SessionEventDocument {
    if (session.status !== 'completed') {
        throw new Error('Only completed typing sessions can be persisted');
    }

    if (session.events.length > MAX_STORED_SESSION_EVENTS) {
        throw new SessionEventDocumentTooLargeError('Too many typing events');
    }

    const events: StoredSessionEvent[] = session.events.map((event) => {
        if (event.type === 'insert') {
            return {
                sequence: event.sequence,
                type: 'insert',
                position: event.position,
                enteredCharacter: event.enteredCharacter,
                timestampMs: event.timestampMs,
            };
        }

        return {
            sequence: event.sequence,
            type: 'backspace',
            position: event.position,
            timestampMs: event.timestampMs,
        };
    });

    const document: SessionEventDocument = {
        _id: sessionId,
        schemaVersion: SESSION_EVENT_SCHEMA_VERSION,
        events,
    };

    const documentSize = Buffer.byteLength(JSON.stringify(document), 'utf8');

    if (documentSize > MAX_SESSION_EVENT_DOCUMENT_BYTES) {
        throw new SessionEventDocumentTooLargeError('Typing event document exceeds the size limit');
    }

    return document;
}

export function replayStoredSessionEvents(
    targetText: string,
    document: SessionEventDocument,
): TypingSessionState {
    if (!isSessionEventDocument(document)) {
        throw new Error('Invalid or unsupported stored typing event document');
    }

    let session = createTypingSession(targetText);

    for (const event of document.events) {
        const input: TypingInput =
            event.type === 'insert'
                ? {
                      type: 'insert',
                      value: event.enteredCharacter,
                      timestampMs: event.timestampMs,
                  }
                : {
                      type: 'backspace',
                      timestampMs: event.timestampMs,
                  };

        let nextSession: TypingSessionState;

        try {
            nextSession = applyTypingInput(session, input);
        } catch (error) {
            throw new Error('Stored typing event sequence is inconsistent', { cause: error });
        }

        const reconstructedEvent = nextSession.events.at(-1);

        if (
            nextSession === session ||
            reconstructedEvent === undefined ||
            reconstructedEvent.sequence !== event.sequence ||
            reconstructedEvent.position !== event.position ||
            reconstructedEvent.type !== event.type ||
            reconstructedEvent.timestampMs !== event.timestampMs
        ) {
            throw new Error('Stored typing event sequence is inconsistent');
        }

        session = nextSession;
    }

    if (session.status !== 'completed') {
        throw new Error('Stored typing events do not complete the session');
    }

    return session;
}
