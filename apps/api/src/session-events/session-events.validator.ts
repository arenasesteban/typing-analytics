import {
    MAX_SESSION_EVENT_DOCUMENT_BYTES,
    MAX_STORED_SESSION_EVENTS,
    SESSION_EVENT_SCHEMA_VERSION,
} from './session-events.constants.js';
import type { SessionEventDocument } from './session-events.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
    const keys = Object.keys(value);

    return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function isValidTimestamp(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= Number.MAX_SAFE_INTEGER
    );
}

function isValidPosition(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isSessionEventDocument(value: unknown): value is SessionEventDocument {
    if (!isRecord(value)) {
        return false;
    }

    if (
        !hasExactKeys(value, ['_id', 'schemaVersion', 'events']) ||
        typeof value['_id'] !== 'string' ||
        value['_id'].length === 0 ||
        value['schemaVersion'] !== SESSION_EVENT_SCHEMA_VERSION
    ) {
        return false;
    }

    const events = value['events'];

    if (
        !Array.isArray(events) ||
        events.length === 0 ||
        events.length > MAX_STORED_SESSION_EVENTS
    ) {
        return false;
    }

    let previousTimestamp = -1;

    for (const [index, event] of events.entries()) {
        if (!isRecord(event)) {
            return false;
        }

        if (
            event['sequence'] !== index ||
            !isValidPosition(event['position']) ||
            !isValidTimestamp(event['timestampMs'])
        ) {
            return false;
        }

        if (event['timestampMs'] < previousTimestamp) {
            return false;
        }

        if (event['type'] === 'insert') {
            if (
                !hasExactKeys(event, [
                    'sequence',
                    'type',
                    'position',
                    'enteredCharacter',
                    'timestampMs',
                ])
            ) {
                return false;
            }

            const character = event['enteredCharacter'];

            if (typeof character !== 'string' || Array.from(character).length !== 1) {
                return false;
            }
        } else if (event['type'] === 'backspace') {
            if (!hasExactKeys(event, ['sequence', 'type', 'position', 'timestampMs'])) {
                return false;
            }
        } else {
            return false;
        }

        previousTimestamp = event['timestampMs'];
    }

    try {
        return Buffer.byteLength(JSON.stringify(value), 'utf8') <= MAX_SESSION_EVENT_DOCUMENT_BYTES;
    } catch {
        return false;
    }
}
