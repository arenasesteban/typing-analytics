import type { SessionBehavioralResult, TypingErrorMarker } from '@typing-analytics/typing-core';

import {
    hasExactKeys,
    isDateTimeString,
    isFiniteNumber,
    isNonNegativeFiniteNumber,
    isNonNegativeInteger,
    isPositiveInteger,
    isRecord,
} from '../shared/validation';

export interface TypingText {
    readonly id: string;
    readonly text: string;
}

export interface CreatedTypingSession {
    readonly id: string;
    readonly typingText: TypingText;
}

export interface PersistedTypingSessionResult {
    readonly id: string;
    readonly durationMs: number;
    readonly wpm: number;
    readonly rawWpm: number;
    readonly accuracy: number;
    readonly consistency: number;
    readonly totalInputs: number;
    readonly correctInputs: number;
    readonly incorrectInputs: number;
    readonly startedAt: string;
    readonly completedAt: string;
}

export interface CompletedTypingSession extends PersistedTypingSessionResult {
    readonly typingText: TypingText;
}

export type TypingSessionHistoryItem = PersistedTypingSessionResult;

export interface TypingSessionHistoryPagination {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
}

export interface TypingSessionHistoryResponse {
    readonly items: readonly TypingSessionHistoryItem[];
    readonly pagination: TypingSessionHistoryPagination;
}

export type TypingSessionBehavioralResponse =
    | {
          readonly status: 'ready';
          readonly temporal: SessionBehavioralResult['temporal'];
      }
    | {
          readonly status: 'pending' | 'unavailable';
      };

export interface TypingSessionHistoryDetail extends CompletedTypingSession {
    readonly behavioral: TypingSessionBehavioralResponse;
}

function isTypingText(value: unknown): value is TypingText {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        typeof value['text'] === 'string' &&
        value['text'].length > 0
    );
}

export function isCreatedTypingSession(value: unknown): value is CreatedTypingSession {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        isTypingText(value['typingText'])
    );
}

function isPersistedTypingSessionResult(value: unknown): value is PersistedTypingSessionResult {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        isNonNegativeFiniteNumber(value['durationMs']) &&
        isFiniteNumber(value['wpm']) &&
        isFiniteNumber(value['rawWpm']) &&
        isFiniteNumber(value['accuracy']) &&
        isFiniteNumber(value['consistency']) &&
        isNonNegativeInteger(value['totalInputs']) &&
        isNonNegativeInteger(value['correctInputs']) &&
        isNonNegativeInteger(value['incorrectInputs']) &&
        isDateTimeString(value['startedAt']) &&
        isDateTimeString(value['completedAt'])
    );
}

export function isCompletedTypingSession(value: unknown): value is CompletedTypingSession {
    return (
        isRecord(value) &&
        isPersistedTypingSessionResult(value) &&
        isTypingText(value['typingText'])
    );
}

function isTypingSessionHistoryPagination(value: unknown): value is TypingSessionHistoryPagination {
    return (
        isRecord(value) &&
        isPositiveInteger(value['page']) &&
        isPositiveInteger(value['pageSize']) &&
        isNonNegativeInteger(value['totalItems']) &&
        isNonNegativeInteger(value['totalPages'])
    );
}

export function isTypingSessionHistoryResponse(
    value: unknown,
): value is TypingSessionHistoryResponse {
    return (
        isRecord(value) &&
        Array.isArray(value['items']) &&
        value['items'].every(isPersistedTypingSessionResult) &&
        isTypingSessionHistoryPagination(value['pagination'])
    );
}

function isErrorMarker(value: unknown): value is TypingErrorMarker {
    if (
        !isRecord(value) ||
        !hasExactKeys(value, [
            'sequence',
            'elapsedMs',
            'position',
            'expectedCharacter',
            'enteredCharacter',
            'corrected',
            'correctionSequence',
            'correctionElapsedMs',
        ])
    ) {
        return false;
    }

    if (
        !isNonNegativeInteger(value['sequence']) ||
        !isNonNegativeFiniteNumber(value['elapsedMs']) ||
        !isNonNegativeInteger(value['position']) ||
        typeof value['expectedCharacter'] !== 'string' ||
        Array.from(value['expectedCharacter']).length !== 1 ||
        typeof value['enteredCharacter'] !== 'string' ||
        Array.from(value['enteredCharacter']).length !== 1 ||
        typeof value['corrected'] !== 'boolean'
    ) {
        return false;
    }

    if (!value['corrected']) {
        return value['correctionSequence'] === null && value['correctionElapsedMs'] === null;
    }

    return (
        isNonNegativeInteger(value['correctionSequence']) &&
        value['correctionSequence'] > value['sequence'] &&
        isNonNegativeFiniteNumber(value['correctionElapsedMs']) &&
        value['correctionElapsedMs'] >= value['elapsedMs']
    );
}

function isTemporalResult(
    value: unknown,
    durationMs: number,
): value is SessionBehavioralResult['temporal'] {
    if (
        !isRecord(value) ||
        !hasExactKeys(value, ['sampleIntervalMs', 'points', 'errorMarkers']) ||
        value['sampleIntervalMs'] !== 1000 ||
        !Array.isArray(value['points']) ||
        !Array.isArray(value['errorMarkers'])
    ) {
        return false;
    }

    const expectedPointCount = durationMs === 0 ? 1 : Math.ceil(durationMs / 1000);

    if (value['points'].length !== expectedPointCount) {
        return false;
    }

    for (const [index, point] of value['points'].entries()) {
        if (
            !isRecord(point) ||
            !hasExactKeys(point, ['elapsedMs', 'wpm', 'rawWpm']) ||
            !isNonNegativeFiniteNumber(point['elapsedMs']) ||
            !isNonNegativeFiniteNumber(point['wpm']) ||
            !isNonNegativeFiniteNumber(point['rawWpm'])
        ) {
            return false;
        }

        const expectedElapsedMs = durationMs === 0 ? 0 : Math.min((index + 1) * 1000, durationMs);

        if (point['elapsedMs'] !== expectedElapsedMs) {
            return false;
        }
    }

    return value['errorMarkers'].every(
        (marker) =>
            isErrorMarker(marker) &&
            marker.elapsedMs <= durationMs &&
            (marker.correctionElapsedMs === null || marker.correctionElapsedMs <= durationMs),
    );
}

export function isTypingSessionBehavioralResponse(
    value: unknown,
    durationMs: number,
): value is TypingSessionBehavioralResponse {
    if (!isRecord(value) || !isNonNegativeFiniteNumber(durationMs)) {
        return false;
    }

    if (value['status'] === 'pending' || value['status'] === 'unavailable') {
        return hasExactKeys(value, ['status']);
    }

    return (
        value['status'] === 'ready' &&
        hasExactKeys(value, ['status', 'temporal']) &&
        isTemporalResult(value['temporal'], durationMs)
    );
}

export function isTypingSessionHistoryDetail(value: unknown): value is TypingSessionHistoryDetail {
    return (
        isRecord(value) &&
        isCompletedTypingSession(value) &&
        isTypingSessionBehavioralResponse(value['behavioral'], value.durationMs)
    );
}
