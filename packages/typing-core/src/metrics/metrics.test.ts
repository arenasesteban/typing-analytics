import { describe, expect, it } from 'vitest';

import { applyTypingInput, createTypingSession } from '../session';
import {
    calculateAccuracy,
    calculateConsistency,
    calculateDurationMs,
    calculateEventLatencies,
    calculateRawWpm,
    calculateWpm,
    summarizeCompletedSession,
} from './metrics';

function createCompletedSession() {
    let session = createTypingSession('abc');

    session = applyTypingInput(session, {
        type: 'insert',
        value: 'a',
        timestampMs: 100,
    });

    session = applyTypingInput(session, {
        type: 'insert',
        value: 'x',
        timestampMs: 200,
    });

    session = applyTypingInput(session, {
        type: 'backspace',
        timestampMs: 250,
    });

    session = applyTypingInput(session, {
        type: 'insert',
        value: 'b',
        timestampMs: 400,
    });

    session = applyTypingInput(session, {
        type: 'insert',
        value: 'c',
        timestampMs: 700,
    });

    return session;
}

describe('calculateDurationMs', () => {
    it('derives duration from supplied timestamps', () => {
        expect(calculateDurationMs(100, 1_100)).toBe(1_000);
    });

    it('rejects completion before session start', () => {
        expect(() => calculateDurationMs(200, 100)).toThrow(RangeError);
    });
});

describe('calculateRawWpm', () => {
    it('uses all character insertions', () => {
        expect(calculateRawWpm(5, 60_000)).toBe(1);
    });

    it('returns zero when elapsed time is zero', () => {
        expect(calculateRawWpm(1, 0)).toBe(0);
    });
});

describe('calculateWpm', () => {
    it('uses correct character insertions', () => {
        expect(calculateWpm(4, 60_000)).toBeCloseTo(0.8);
    });

    it('returns zero when elapsed time is zero', () => {
        expect(calculateWpm(1, 0)).toBe(0);
    });
});

describe('calculateAccuracy', () => {
    it('calculates correct insertions over total insertions', () => {
        expect(calculateAccuracy(4, 5)).toBe(80);
    });

    it('returns zero when no insertions exist', () => {
        expect(calculateAccuracy(0, 0)).toBe(0);
    });

    it('rejects more correct inputs than total inputs', () => {
        expect(() => calculateAccuracy(2, 1)).toThrow(RangeError);
    });
});

describe('calculateEventLatencies', () => {
    it('calculates latency between consecutive domain events', () => {
        const session = createCompletedSession();

        expect(calculateEventLatencies(session.events)).toEqual([100, 50, 150, 300]);
    });

    it('returns no latency for a single event', () => {
        const initial = createTypingSession('ab');

        const active = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        expect(calculateEventLatencies(active.events)).toEqual([]);
    });
});

describe('calculateConsistency', () => {
    it('returns 100 for a perfectly uniform rhythm', () => {
        expect(calculateConsistency([100, 100, 100])).toBe(100);
    });

    it('returns a normalized deterministic score for variable latency', () => {
        expect(calculateConsistency([100, 200])).toBeCloseTo(75);

        expect(calculateConsistency([100, 200])).toBe(calculateConsistency([100, 200]));
    });

    it('keeps the score within the normalized range', () => {
        const consistency = calculateConsistency([10, 100, 500, 1_000]);

        expect(consistency).toBeGreaterThanOrEqual(0);
        expect(consistency).toBeLessThanOrEqual(100);
    });

    it('returns 100 when no latency variation can be observed', () => {
        expect(calculateConsistency([])).toBe(100);

        expect(calculateConsistency([0, 0, 0])).toBe(100);
    });
});

describe('summarizeCompletedSession', () => {
    it('returns deterministic metrics from the session event history', () => {
        const session = createCompletedSession();

        const summary = summarizeCompletedSession(session);

        expect(summary.durationMs).toBe(600);

        expect(summary.totalInputs).toBe(4);
        expect(summary.correctInputs).toBe(3);
        expect(summary.incorrectInputs).toBe(1);

        expect(summary.rawWpm).toBeCloseTo(80);
        expect(summary.wpm).toBeCloseTo(60);
        expect(summary.accuracy).toBeCloseTo(75);

        expect(summary.latenciesMs).toEqual([100, 50, 150, 300]);

        expect(summary.consistency).toBeCloseTo(61.59116, 5);

        expect(summary.startedAtMs).toBe(100);
        expect(summary.completedAtMs).toBe(700);
    });

    it('produces the same summary for the same event sequence', () => {
        const firstSummary = summarizeCompletedSession(createCompletedSession());

        const secondSummary = summarizeCompletedSession(createCompletedSession());

        expect(firstSummary).toEqual(secondSummary);
    });

    it('handles a zero-duration completed session without Infinity or NaN', () => {
        const initial = createTypingSession('a');

        const completed = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        const summary = summarizeCompletedSession(completed);

        expect(summary.durationMs).toBe(0);
        expect(summary.rawWpm).toBe(0);
        expect(summary.wpm).toBe(0);
        expect(summary.accuracy).toBe(100);
        expect(summary.consistency).toBe(100);
        expect(summary.latenciesMs).toEqual([]);
    });

    it('rejects sessions that are not completed', () => {
        const session = createTypingSession('abc');

        expect(() => summarizeCompletedSession(session)).toThrow(
            'Only completed typing sessions can be summarized.',
        );
    });
});
