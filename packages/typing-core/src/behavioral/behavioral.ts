import { calculateRawWpm, calculateWpm, summarizeCompletedSession } from '../metrics';
import type { CompletedSessionSummary } from '../metrics';
import type { CharacterInsertEvent, TypingSessionState } from '../session';
import type { SessionBehavioralResult, TemporalPerformancePoint } from './behavioral.types';

export const SESSION_TEMPORAL_SAMPLE_INTERVAL_MS = 1000 as const;

function assertCompletedSessionEventsConsistent(
    session: TypingSessionState,
    summary: CompletedSessionSummary,
): void {
    const targetCharacters = Array.from(session.targetText);
    const activeInsertions: CharacterInsertEvent[] = [];

    if (session.events[0]?.timestampMs !== summary.startedAtMs) {
        throw new Error('Session start does not match the first event.');
    }

    let previousTimestampMs = summary.startedAtMs;

    for (const [index, event] of session.events.entries()) {
        if (event.sequence !== index) {
            throw new Error('Typing event sequence is invalid.');
        }

        if (
            !Number.isFinite(event.timestampMs) ||
            event.timestampMs < previousTimestampMs ||
            event.timestampMs > summary.completedAtMs
        ) {
            throw new Error('Typing event is outside session boundaries.');
        }

        previousTimestampMs = event.timestampMs;

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
    }

    if (
        activeInsertions.length !== targetCharacters.length ||
        session.currentPosition !== targetCharacters.length ||
        session.events.at(-1)?.timestampMs !== summary.completedAtMs
    ) {
        throw new Error('Completed typing session is inconsistent.');
    }
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

    if (points.length === 0 || points[points.length - 1].elapsedMs !== summary.durationMs) {
        appendPoint(summary.durationMs);
    }

    return points;
}

export function deriveSessionBehavioralResult(
    session: TypingSessionState,
): SessionBehavioralResult {
    const summary = summarizeCompletedSession(session);

    assertCompletedSessionEventsConsistent(session, summary);

    return {
        temporal: {
            sampleIntervalMs: SESSION_TEMPORAL_SAMPLE_INTERVAL_MS,
            points: deriveTemporalPoints(session, summary),
        },
    };
}
