import { describe, expect, it } from 'vitest';

import {
    MAX_STORED_SESSION_EVENTS,
    SESSION_EVENT_SCHEMA_VERSION,
} from './session-events.constants.js';
import { isSessionEventDocument } from './session-events.validator.js';

function validDocument() {
    return {
        _id: 'session-1',
        schemaVersion: SESSION_EVENT_SCHEMA_VERSION,
        events: [
            {
                sequence: 0,
                type: 'insert',
                position: 0,
                enteredCharacter: 'a',
                timestampMs: 100,
            },
            {
                sequence: 1,
                type: 'backspace',
                position: 0,
                timestampMs: 200,
            },
        ],
    };
}

describe('Session events validator', () => {
    it('accepts a valid versioned event document', () => {
        expect(isSessionEventDocument(validDocument())).toBe(true);
    });

    it('rejects an unsupported schema version', () => {
        const document = {
            ...validDocument(),
            schemaVersion: 2,
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects an empty event sequence', () => {
        const document = {
            ...validDocument(),
            events: [],
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects an incorrect event sequence number', () => {
        const document = {
            ...validDocument(),
            events: [
                {
                    sequence: 1,
                    type: 'insert',
                    position: 0,
                    enteredCharacter: 'a',
                    timestampMs: 100,
                },
            ],
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects decreasing timestamps', () => {
        const document = validDocument();

        document.events[1].timestampMs = 50;

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('accepts equal timestamps', () => {
        const document = validDocument();

        document.events[1].timestampMs = 100;

        expect(isSessionEventDocument(document)).toBe(true);
    });

    it('rejects an invalid position', () => {
        const document = {
            ...validDocument(),
            events: [
                {
                    sequence: 0,
                    type: 'insert',
                    position: -1,
                    enteredCharacter: 'a',
                    timestampMs: 100,
                },
            ],
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects non-finite timestamps', () => {
        const document = {
            ...validDocument(),
            events: [
                {
                    sequence: 0,
                    type: 'insert',
                    position: 0,
                    enteredCharacter: 'a',
                    timestampMs: Number.POSITIVE_INFINITY,
                },
            ],
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects inserted values containing multiple characters', () => {
        const document = {
            ...validDocument(),
            events: [
                {
                    sequence: 0,
                    type: 'insert',
                    position: 0,
                    enteredCharacter: 'abc',
                    timestampMs: 100,
                },
            ],
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects additional fields in stored events', () => {
        const document = {
            ...validDocument(),
            events: [
                {
                    sequence: 0,
                    type: 'insert',
                    position: 0,
                    enteredCharacter: 'a',
                    expectedCharacter: 'a',
                    timestampMs: 100,
                },
            ],
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects additional document fields', () => {
        const document = {
            ...validDocument(),
            userId: 'user-1',
        };

        expect(isSessionEventDocument(document)).toBe(false);
    });

    it('rejects event sequences exceeding the storage limit', () => {
        const events = Array.from({ length: MAX_STORED_SESSION_EVENTS + 1 }, (_, sequence) => ({
            sequence,
            type: 'insert',
            position: sequence,
            enteredCharacter: 'a',
            timestampMs: sequence,
        }));

        expect(
            isSessionEventDocument({
                _id: 'session-1',
                schemaVersion: 1,
                events,
            }),
        ).toBe(false);
    });

    it('rejects missing document identifiers', () => {
        expect(
            isSessionEventDocument({
                schemaVersion: 1,
                events: validDocument().events,
            }),
        ).toBe(false);
    });
});
