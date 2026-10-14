import {
    calculateAccuracy,
    calculateRawWpm,
    calculateWpm,
    summarizeCompletedSession,
} from '../metrics';
import type { CompletedSessionSummary } from '../metrics';
import type { BackspaceEvent, CharacterInsertEvent, TypingSessionState } from '../session';
import type {
    BehavioralOptions,
    CharacterStatistics,
    SessionBehavioralResult,
    TemporalPerformancePoint,
    TypingErrorMarker,
} from './behavioral.types';

export const DEFAULT_BEHAVIORAL_OPTIONS = {
    windowMs: 5_000,
    minimumSample: 5,
    errorRateThresholdPct: 30,
} as const;

interface ErrorRecord {
    readonly insertion: CharacterInsertEvent;
    correction: BackspaceEvent | null;
}

interface CharacterCounts {
    total: number;
    correct: number;
    incorrect: number;
}

function resolveOptions(options: BehavioralOptions): Required<BehavioralOptions> {
    const resolved = {
        ...DEFAULT_BEHAVIORAL_OPTIONS,
        ...options,
    };

    if (!Number.isSafeInteger(resolved.windowMs) || resolved.windowMs <= 0) {
        throw new RangeError('windowMs must be a positive safe integer.');
    }

    if (!Number.isSafeInteger(resolved.minimumSample) || resolved.minimumSample < 1) {
        throw new RangeError('minimumSample must be a positive safe integer.');
    }

    if (
        !Number.isFinite(resolved.errorRateThresholdPct) ||
        resolved.errorRateThresholdPct < 0 ||
        resolved.errorRateThresholdPct > 100
    ) {
        throw new RangeError('errorRateThresholdPct must be between 0 and 100.');
    }

    return resolved;
}

function deriveTemporalPoints(
    session: TypingSessionState,
    summary: CompletedSessionSummary,
    windowMs: number,
): TemporalPerformancePoint[] {
    const insertions = session.events.filter(
        (event): event is CharacterInsertEvent => event.type === 'insert',
    );

    const points: TemporalPerformancePoint[] = [
        {
            elapsedMs: 0,
            windowDurationMs: 0,
            cumulativeWpm: 0,
            cumulativeRawWpm: 0,
            windowWpm: 0,
            windowRawWpm: 0,
        },
    ];

    if (summary.durationMs === 0) {
        return points;
    }

    let elapsedMs = 0;
    let insertionIndex = 0;
    let cumulativeTotal = 0;
    let cumulativeCorrect = 0;

    while (elapsedMs < summary.durationMs) {
        const nextElapsedMs = Math.min(elapsedMs + windowMs, summary.durationMs);

        const windowDurationMs = nextElapsedMs - elapsedMs;
        const windowEndTimestamp = summary.startedAtMs + nextElapsedMs;

        let windowTotal = 0;
        let windowCorrect = 0;

        while (
            insertionIndex < insertions.length &&
            insertions[insertionIndex].timestampMs <= windowEndTimestamp
        ) {
            const insertion = insertions[insertionIndex];

            windowTotal += 1;

            if (insertion.correct) {
                windowCorrect += 1;
            }

            insertionIndex += 1;
        }

        cumulativeTotal += windowTotal;
        cumulativeCorrect += windowCorrect;

        points.push({
            elapsedMs: nextElapsedMs,
            windowDurationMs,
            cumulativeWpm: calculateWpm(cumulativeCorrect, nextElapsedMs),
            cumulativeRawWpm: calculateRawWpm(cumulativeTotal, nextElapsedMs),
            windowWpm: calculateWpm(windowCorrect, windowDurationMs),
            windowRawWpm: calculateRawWpm(windowTotal, windowDurationMs),
        });

        elapsedMs = nextElapsedMs;
    }

    return points;
}

function deriveErrorMarkers(
    session: TypingSessionState,
    summary: CompletedSessionSummary,
): TypingErrorMarker[] {
    const targetCharacters = Array.from(session.targetText);
    const activeInsertions: CharacterInsertEvent[] = [];
    const errors: ErrorRecord[] = [];
    const errorsBySequence = new Map<number, ErrorRecord>();

    if (session.events[0]?.timestampMs !== summary.startedAtMs) {
        throw new Error('Session start does not match the first event.');
    }

    for (const [index, event] of session.events.entries()) {
        if (event.sequence !== index) {
            throw new Error('Typing event sequence is invalid.');
        }

        if (event.timestampMs < summary.startedAtMs || event.timestampMs > summary.completedAtMs) {
            throw new Error('Typing event is outside session boundaries.');
        }

        if (event.type === 'insert') {
            const expectedCharacter = targetCharacters.at(event.position);

            if (
                event.position !== activeInsertions.length ||
                expectedCharacter === undefined ||
                event.expectedCharacter !== expectedCharacter ||
                event.correct !== (event.enteredCharacter === expectedCharacter)
            ) {
                throw new Error('Typing insertion is inconsistent.');
            }

            activeInsertions.push(event);

            if (!event.correct) {
                const record: ErrorRecord = {
                    insertion: event,
                    correction: null,
                };

                errors.push(record);
                errorsBySequence.set(event.sequence, record);
            }

            continue;
        }

        const removedInsertion = activeInsertions.pop();

        if (
            removedInsertion === undefined ||
            removedInsertion.position !== event.position ||
            removedInsertion.expectedCharacter !== event.expectedCharacter ||
            removedInsertion.enteredCharacter !== event.removedCharacter ||
            removedInsertion.correct !== event.removedCorrect
        ) {
            throw new Error('Backspace event is inconsistent.');
        }

        const errorRecord = errorsBySequence.get(removedInsertion.sequence);

        if (errorRecord !== undefined) {
            errorRecord.correction = event;
        }
    }

    if (
        activeInsertions.length !== targetCharacters.length ||
        session.currentPosition !== targetCharacters.length ||
        session.events.at(-1)?.timestampMs !== summary.completedAtMs
    ) {
        throw new Error('Completed typing session is inconsistent.');
    }

    return errors.map(({ insertion, correction }) => ({
        sequence: insertion.sequence,
        elapsedMs: insertion.timestampMs - summary.startedAtMs,
        position: insertion.position,
        expectedCharacter: insertion.expectedCharacter,
        enteredCharacter: insertion.enteredCharacter,
        corrected: correction !== null,
        correctionSequence: correction?.sequence ?? null,
        correctionElapsedMs:
            correction === null ? null : correction.timestampMs - summary.startedAtMs,
    }));
}

function deriveCharacterStatistics(
    insertions: readonly CharacterInsertEvent[],
    minimumSample: number,
    errorRateThresholdPct: number,
): CharacterStatistics[] {
    const counts = new Map<string, CharacterCounts>();

    for (const insertion of insertions) {
        const character = insertion.expectedCharacter;

        const current = counts.get(character) ?? {
            total: 0,
            correct: 0,
            incorrect: 0,
        };

        current.total += 1;

        if (insertion.correct) {
            current.correct += 1;
        } else {
            current.incorrect += 1;
        }

        counts.set(character, current);
    }

    return Array.from(counts, ([expectedCharacter, count]) => {
        const accuracy = calculateAccuracy(count.correct, count.total);

        const errorRate = (count.incorrect / count.total) * 100;
        const sufficientSample = count.total >= minimumSample;

        return {
            expectedCharacter,
            sampleCount: count.total,
            correctInputs: count.correct,
            incorrectInputs: count.incorrect,
            errorRate,
            accuracy,
            sufficientSample,
            problematic: sufficientSample ? errorRate >= errorRateThresholdPct : null,
        };
    });
}

export function deriveSessionBehavioralResult(
    session: TypingSessionState,
    options: BehavioralOptions = {},
): SessionBehavioralResult {
    const resolvedOptions = resolveOptions(options);

    // Reuses the established completed-session validation and formulas.
    const summary = summarizeCompletedSession(session);

    const errorMarkers = deriveErrorMarkers(session, summary);

    const insertions = session.events.filter(
        (event): event is CharacterInsertEvent => event.type === 'insert',
    );

    const points = deriveTemporalPoints(session, summary, resolvedOptions.windowMs);

    return {
        temporal: {
            windowMs: resolvedOptions.windowMs,
            points,
            errorMarkers,
        },
        characters: deriveCharacterStatistics(
            insertions,
            resolvedOptions.minimumSample,
            resolvedOptions.errorRateThresholdPct,
        ),
        characterPolicy: {
            minimumSample: resolvedOptions.minimumSample,
            errorRateThresholdPct: resolvedOptions.errorRateThresholdPct,
        },
    };
}
