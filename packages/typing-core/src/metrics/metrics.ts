import type { CharacterInsertEvent, TypingEvent, TypingSessionState } from '../session';
import type { CompletedSessionSummary } from './metrics.types';

const STANDARD_WORD_LENGTH = 5;
const MILLISECONDS_PER_MINUTE = 60_000;

function assertFiniteNonNegative(value: number, label: string): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${label} must be a finite, non-negative number.`);
    }
}

function assertNonNegativeInteger(value: number, label: string): void {
    if (!Number.isInteger(value) || value < 0) {
        throw new RangeError(`${label} must be a non-negative integer.`);
    }
}

function isCharacterInsertEvent(event: TypingEvent): event is CharacterInsertEvent {
    return event.type === 'insert';
}

function calculateRate(inputCount: number, durationMs: number): number {
    assertNonNegativeInteger(inputCount, 'Input count');
    assertFiniteNonNegative(durationMs, 'Duration');

    if (durationMs === 0) {
        return 0;
    }

    const elapsedMinutes = durationMs / MILLISECONDS_PER_MINUTE;

    return inputCount / STANDARD_WORD_LENGTH / elapsedMinutes;
}

export function calculateDurationMs(startedAtMs: number, completedAtMs: number): number {
    assertFiniteNonNegative(startedAtMs, 'Session start timestamp');

    assertFiniteNonNegative(completedAtMs, 'Session completion timestamp');

    if (completedAtMs < startedAtMs) {
        throw new RangeError('Session completion timestamp cannot precede the start timestamp.');
    }

    return completedAtMs - startedAtMs;
}

export function calculateRawWpm(totalInputs: number, durationMs: number): number {
    return calculateRate(totalInputs, durationMs);
}

export function calculateWpm(correctInputs: number, durationMs: number): number {
    return calculateRate(correctInputs, durationMs);
}

export function calculateAccuracy(correctInputs: number, totalInputs: number): number {
    assertNonNegativeInteger(correctInputs, 'Correct input count');

    assertNonNegativeInteger(totalInputs, 'Total input count');

    if (correctInputs > totalInputs) {
        throw new RangeError('Correct input count cannot exceed total input count.');
    }

    if (totalInputs === 0) {
        return 0;
    }

    return (correctInputs / totalInputs) * 100;
}

export function calculateEventLatencies(events: readonly TypingEvent[]): number[] {
    for (const event of events) {
        assertFiniteNonNegative(event.timestampMs, 'Typing event timestamp');
    }

    const latenciesMs: number[] = [];

    for (let index = 1; index < events.length; index += 1) {
        const previousEvent = events[index - 1];
        const currentEvent = events[index];

        const latencyMs = currentEvent.timestampMs - previousEvent.timestampMs;

        if (latencyMs < 0) {
            throw new RangeError('Typing event timestamps must be monotonically non-decreasing.');
        }

        latenciesMs.push(latencyMs);
    }

    return latenciesMs;
}

export function calculateConsistency(latenciesMs: readonly number[]): number {
    for (const latencyMs of latenciesMs) {
        assertFiniteNonNegative(latencyMs, 'Typing latency');
    }

    if (latenciesMs.length === 0) {
        return 100;
    }

    const mean = latenciesMs.reduce((sum, latencyMs) => sum + latencyMs, 0) / latenciesMs.length;

    if (mean === 0) {
        return 100;
    }

    const variance =
        latenciesMs.reduce((sum, latencyMs) => {
            const difference = latencyMs - mean;

            return sum + difference * difference;
        }, 0) / latenciesMs.length;

    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;

    const consistency = 100 / (1 + coefficientOfVariation);

    return Math.min(100, Math.max(0, consistency));
}

export function summarizeCompletedSession(session: TypingSessionState): CompletedSessionSummary {
    if (session.status !== 'completed') {
        throw new Error('Only completed typing sessions can be summarized.');
    }

    if (session.startedAtMs === null || session.completedAtMs === null) {
        throw new Error('Completed typing session must contain start and completion timestamps.');
    }

    const insertEvents = session.events.filter(isCharacterInsertEvent);

    const totalInputs = insertEvents.length;

    const correctInputs = insertEvents.filter((event) => event.correct).length;

    const incorrectInputs = totalInputs - correctInputs;

    if (totalInputs === 0) {
        throw new Error('Completed typing session must contain at least one character insertion.');
    }

    const durationMs = calculateDurationMs(session.startedAtMs, session.completedAtMs);

    const latenciesMs = calculateEventLatencies(session.events);

    return {
        durationMs,
        rawWpm: calculateRawWpm(totalInputs, durationMs),
        wpm: calculateWpm(correctInputs, durationMs),
        accuracy: calculateAccuracy(correctInputs, totalInputs),
        consistency: calculateConsistency(latenciesMs),
        totalInputs,
        correctInputs,
        incorrectInputs,
        startedAtMs: session.startedAtMs,
        completedAtMs: session.completedAtMs,
        latenciesMs,
    };
}
