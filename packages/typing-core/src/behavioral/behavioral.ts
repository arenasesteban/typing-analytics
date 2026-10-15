import { calculateRawWpm, calculateWpm, summarizeCompletedSession } from '../metrics';
import type { CompletedSessionSummary } from '../metrics';
import type { BackspaceEvent, CharacterInsertEvent, TypingSessionState } from '../session';
import type {
    SessionBehavioralResult,
    TemporalPerformancePoint,
    TypingErrorMarker,
} from './behavioral.types';

export const SESSION_TEMPORAL_SAMPLE_INTERVAL_MS = 1000 as const;

interface ErrorRecord {
    readonly insertion: CharacterInsertEvent;
    correction: BackspaceEvent | null;
}

function deriveTemporalPoints(
    session: TypingSessionState,
    summary: CompletedSessionSummary,
): TemporalPerformancePoint[] {
    const insertions = session.events.filter(
        (event): event is CharacterInsertEvent => event.type === 'insert',
    );

    if (summary.durationMs === 0) {
        return [
            {
                elapsedMs: 0,
                wpm: summary.wpm,
                rawWpm: summary.rawWpm,
            },
        ];
    }

    const points: TemporalPerformancePoint[] = [];

    let insertionIndex = 0;
    let cumulativeTotal = 0;
    let cumulativeCorrect = 0;

    const appendPoint = (elapsedMs: number): void => {
        const sampleTimestampMs = summary.startedAtMs + elapsedMs;

        while (
            insertionIndex < insertions.length &&
            insertions[insertionIndex].timestampMs <= sampleTimestampMs
        ) {
            const insertion = insertions[insertionIndex];

            cumulativeTotal += 1;

            if (insertion.correct) {
                cumulativeCorrect += 1;
            }

            insertionIndex += 1;
        }

        points.push({
            elapsedMs,
            wpm: calculateWpm(cumulativeCorrect, elapsedMs),
            rawWpm: calculateRawWpm(cumulativeTotal, elapsedMs),
        });
    };

    for (
        let elapsedMs = SESSION_TEMPORAL_SAMPLE_INTERVAL_MS;
        elapsedMs <= summary.durationMs;
        elapsedMs += SESSION_TEMPORAL_SAMPLE_INTERVAL_MS
    ) {
        appendPoint(elapsedMs);
    }

    const finalSampleMs = summary.durationMs;

    if (points.length === 0 || points[points.length - 1].elapsedMs !== finalSampleMs) {
        appendPoint(finalSampleMs);
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

export function deriveSessionBehavioralResult(
    session: TypingSessionState,
): SessionBehavioralResult {
    const summary = summarizeCompletedSession(session);

    const errorMarkers = deriveErrorMarkers(session, summary);
    const points = deriveTemporalPoints(session, summary);

    return {
        temporal: {
            sampleIntervalMs: SESSION_TEMPORAL_SAMPLE_INTERVAL_MS,
            points,
            errorMarkers,
        },
    };
}
