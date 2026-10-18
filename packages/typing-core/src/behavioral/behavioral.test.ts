import { describe, expect, it } from 'vitest';

import { summarizeCompletedSession } from '../metrics';
import { applyTypingInput, createTypingSession } from '../session';
import type { TypingInput, TypingSessionState } from '../session';
import { SESSION_TEMPORAL_SAMPLE_INTERVAL_MS, deriveSessionBehavioralResult } from './behavioral';

function completedSession(target: string, inputs: readonly TypingInput[]): TypingSessionState {
    return inputs.reduce<TypingSessionState>(
        (state, input) => applyTypingInput(state, input),
        createTypingSession(target),
    );
}

function correctedSession(): TypingSessionState {
    return completedSession('abc', [
        { type: 'insert', value: 'a', timestampMs: 100 },
        { type: 'insert', value: 'x', timestampMs: 1100 },
        { type: 'backspace', timestampMs: 1200 },
        { type: 'insert', value: 'b', timestampMs: 2100 },
        { type: 'insert', value: 'c', timestampMs: 2600 },
    ]);
}

describe('deriveSessionBehavioralResult', () => {
    it('rejects incomplete sessions', () => {
        expect(() => deriveSessionBehavioralResult(createTypingSession('abc'))).toThrow();
    });

    it('exposes only the approved temporal contract', () => {
        const result = deriveSessionBehavioralResult(correctedSession());

        expect(Object.keys(result)).toEqual(['temporal']);

        expect(Object.keys(result.temporal)).toEqual(['sampleIntervalMs', 'points']);

        expect(SESSION_TEMPORAL_SAMPLE_INTERVAL_MS).toBe(1000);
        expect(result.temporal.sampleIntervalMs).toBe(1000);

        for (const point of result.temporal.points) {
            expect(Object.keys(point)).toEqual(['elapsedMs', 'wpm', 'rawWpm']);
        }
    });

    it('generates one sample per complete second', () => {
        const session = completedSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 25100 },
        ]);

        const points = deriveSessionBehavioralResult(session).temporal.points;

        expect(points).toHaveLength(25);
        expect(points.map((point) => point.elapsedMs)).toEqual(
            Array.from({ length: 25 }, (_, index) => (index + 1) * 1000),
        );
    });

    it('appends the exact final sample without duplication', () => {
        const session = completedSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 25450 },
        ]);

        const points = deriveSessionBehavioralResult(session).temporal.points;

        expect(points).toHaveLength(26);
        expect(points.at(-2)?.elapsedMs).toBe(25000);
        expect(points.at(-1)?.elapsedMs).toBe(25350);

        expect(new Set(points.map((point) => point.elapsedMs)).size).toBe(points.length);
    });

    it('handles durations below one second', () => {
        const session = completedSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 450 },
        ]);

        const summary = summarizeCompletedSession(session);
        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.points).toHaveLength(1);
        expect(result.temporal.points[0].elapsedMs).toBe(350);
        expect(result.temporal.points[0].wpm).toBeCloseTo(summary.wpm);
        expect(result.temporal.points[0].rawWpm).toBeCloseTo(summary.rawWpm);
    });

    it('handles zero duration', () => {
        const session = completedSession('a', [{ type: 'insert', value: 'a', timestampMs: 100 }]);

        expect(deriveSessionBehavioralResult(session).temporal.points).toEqual([
            { elapsedMs: 0, wpm: 0, rawWpm: 0 },
        ]);
    });

    it('preserves cumulative calculations with incorrect inserts and Backspace', () => {
        const points = deriveSessionBehavioralResult(correctedSession()).temporal.points;

        expect(points.map((point) => point.elapsedMs)).toEqual([1000, 2000, 2500]);

        expect(points[0].wpm).toBeCloseTo(12);
        expect(points[0].rawWpm).toBeCloseTo(24);

        expect(points[1].wpm).toBeCloseTo(12);
        expect(points[1].rawWpm).toBeCloseTo(18);

        expect(points[2].wpm).toBeCloseTo(14.4);
        expect(points[2].rawWpm).toBeCloseTo(19.2);
    });

    it('includes inserts exactly at a sample boundary', () => {
        const session = completedSession('abc', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 1100 },
            { type: 'insert', value: 'c', timestampMs: 2100 },
        ]);

        const points = deriveSessionBehavioralResult(session).temporal.points;

        expect(points.map((point) => point.elapsedMs)).toEqual([1000, 2000]);

        expect(points[0].wpm).toBeCloseTo(24);
        expect(points[1].wpm).toBeCloseTo(18);
    });

    it('keeps final speeds equivalent to the existing summary', () => {
        const session = correctedSession();
        const summary = summarizeCompletedSession(session);

        const finalPoint = deriveSessionBehavioralResult(session).temporal.points.at(-1);

        expect(finalPoint?.elapsedMs).toBe(summary.durationMs);
        expect(finalPoint?.wpm).toBeCloseTo(summary.wpm);
        expect(finalPoint?.rawWpm).toBeCloseTo(summary.rawWpm);
    });

    it('preserves errors that were not corrected', () => {
        const session = completedSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'x', timestampMs: 1100 },
        ]);

        const summary = summarizeCompletedSession(session);
        const result = deriveSessionBehavioralResult(session);

        expect(summary.incorrectInputs).toBe(1);
        expect(result.temporal.points.at(-1)?.wpm).toBeCloseTo(summary.wpm);
        expect(result.temporal.points.at(-1)?.rawWpm).toBeCloseTo(summary.rawWpm);
    });

    it('produces deterministic results without mutating events', () => {
        const session = correctedSession();
        const originalEvents = session.events.map((event) => ({ ...event }));

        const first = deriveSessionBehavioralResult(session);
        const second = deriveSessionBehavioralResult(session);

        expect(first).toEqual(second);
        expect(session.events).toEqual(originalEvents);
    });

    it('produces equivalent results for shifted absolute timestamps', () => {
        const first = completedSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 2100 },
        ]);

        const second = completedSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 5100 },
            { type: 'insert', value: 'b', timestampMs: 7100 },
        ]);

        expect(deriveSessionBehavioralResult(first)).toEqual(deriveSessionBehavioralResult(second));
    });

    it('rejects an inconsistent event sequence', () => {
        const session = correctedSession();

        const invalid: TypingSessionState = {
            ...session,
            events: session.events.map((event, index) =>
                index === 1 ? { ...event, sequence: 99 } : event,
            ),
        };

        expect(() => deriveSessionBehavioralResult(invalid)).toThrow(
            'Typing event sequence is invalid.',
        );
    });

    it('rejects an inconsistent Backspace event', () => {
        const session = correctedSession();

        const invalid: TypingSessionState = {
            ...session,
            events: session.events.map((event) =>
                event.type === 'backspace' ? { ...event, removedCharacter: 'z' } : event,
            ),
        };

        expect(() => deriveSessionBehavioralResult(invalid)).toThrow(
            'Backspace event is inconsistent.',
        );
    });

    it('rejects an inconsistent insertion', () => {
        const session = correctedSession();

        const invalid: TypingSessionState = {
            ...session,
            events: session.events.map((event) =>
                event.type === 'insert' && event.sequence === 1
                    ? { ...event, correct: true }
                    : event,
            ),
        };

        expect(() => deriveSessionBehavioralResult(invalid)).toThrow(
            'Typing insertion is inconsistent.',
        );
    });

    it('rejects negative event timestamps', () => {
        const session = correctedSession();

        const invalid: TypingSessionState = {
            ...session,
            events: session.events.map((event) =>
                event.sequence === 1 ? { ...event, timestampMs: -1 } : event,
            ),
        };

        expect(() => deriveSessionBehavioralResult(invalid)).toThrow(
            'Typing event timestamp must be a finite, non-negative number.',
        );
    });
});
