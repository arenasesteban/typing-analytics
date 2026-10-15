import { describe, expect, it } from 'vitest';

import { summarizeCompletedSession } from '../metrics';
import { applyTypingInput, createTypingSession } from '../session';
import type { TypingInput, TypingSessionState } from '../session';
import { SESSION_TEMPORAL_SAMPLE_INTERVAL_MS, deriveSessionBehavioralResult } from './behavioral';

function completeSession(target: string, inputs: readonly TypingInput[]): TypingSessionState {
    return inputs.reduce<TypingSessionState>(
        (state, input) => applyTypingInput(state, input),
        createTypingSession(target),
    );
}

function createCorrectedSession(): TypingSessionState {
    return completeSession('abc', [
        { type: 'insert', value: 'a', timestampMs: 100 },
        { type: 'insert', value: 'x', timestampMs: 1_100 },
        { type: 'backspace', timestampMs: 2_100 },
        { type: 'insert', value: 'b', timestampMs: 3_100 },
        { type: 'insert', value: 'c', timestampMs: 6_100 },
    ]);
}

describe('deriveSessionBehavioralResult', () => {
    it('rejects incomplete sessions', () => {
        expect(() => deriveSessionBehavioralResult(createTypingSession('abc'))).toThrow(
            'Only completed typing sessions can be summarized.',
        );
    });

    it('exposes only the approved temporal contract', () => {
        const result = deriveSessionBehavioralResult(createCorrectedSession());

        expect(SESSION_TEMPORAL_SAMPLE_INTERVAL_MS).toBe(1000);

        expect(Object.keys(result)).toEqual(['temporal']);
        expect(Object.keys(result.temporal)).toEqual([
            'sampleIntervalMs',
            'points',
            'errorMarkers',
        ]);

        expect(result.temporal.sampleIntervalMs).toBe(1000);

        for (const point of result.temporal.points) {
            expect(Object.keys(point)).toEqual(['elapsedMs', 'wpm', 'rawWpm']);
        }
    });

    it('generates exactly 25 points for a 25-second session', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 25_100 },
        ]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.points).toHaveLength(25);
        expect(result.temporal.points.map((point) => point.elapsedMs)).toEqual(
            Array.from({ length: 25 }, (_, index) => (index + 1) * 1000),
        );
    });

    it('appends the exact final sample for noninteger seconds', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 25_450 },
        ]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.points).toHaveLength(26);
        expect(result.temporal.points.at(-2)?.elapsedMs).toBe(25_000);
        expect(result.temporal.points.at(-1)?.elapsedMs).toBe(25_350);
    });

    it('does not duplicate the final sample on a whole second', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 3_100 },
        ]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.points.map((point) => point.elapsedMs)).toEqual([
            1_000, 2_000, 3_000,
        ]);
    });

    it('handles a session shorter than one second', () => {
        const session = completeSession('ab', [
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

    it('handles zero-duration sessions without division by zero', () => {
        const session = completeSession('a', [{ type: 'insert', value: 'a', timestampMs: 100 }]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.points).toEqual([
            {
                elapsedMs: 0,
                wpm: 0,
                rawWpm: 0,
            },
        ]);
    });

    it('calculates both series cumulatively', () => {
        const session = completeSession('abc', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'x', timestampMs: 1_100 },
            { type: 'backspace', timestampMs: 1_200 },
            { type: 'insert', value: 'b', timestampMs: 2_100 },
            { type: 'insert', value: 'c', timestampMs: 2_600 },
        ]);

        const points = deriveSessionBehavioralResult(session).temporal.points;

        expect(points.map((point) => point.elapsedMs)).toEqual([1_000, 2_000, 2_500]);

        expect(points[0].wpm).toBeCloseTo(12);
        expect(points[0].rawWpm).toBeCloseTo(24);

        expect(points[1].wpm).toBeCloseTo(12);
        expect(points[1].rawWpm).toBeCloseTo(18);

        expect(points[2].wpm).toBeCloseTo(14.4);
        expect(points[2].rawWpm).toBeCloseTo(19.2);
    });

    it('includes insertions at the exact sample boundary', () => {
        const session = completeSession('abc', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 1_100 },
            { type: 'insert', value: 'c', timestampMs: 2_100 },
        ]);

        const points = deriveSessionBehavioralResult(session).temporal.points;

        expect(points.map((point) => point.elapsedMs)).toEqual([1_000, 2_000]);

        expect(points[0].wpm).toBeCloseTo(24);
        expect(points[1].wpm).toBeCloseTo(18);
    });

    it('reflects inactivity without adding fictional events', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 4_100 },
        ]);

        const points = deriveSessionBehavioralResult(session).temporal.points;

        expect(points.map((point) => point.elapsedMs)).toEqual([1_000, 2_000, 3_000, 4_000]);

        expect(points[0].wpm).toBeCloseTo(12);
        expect(points[1].wpm).toBeCloseTo(6);
        expect(points[2].wpm).toBeCloseTo(4);
        expect(points[3].wpm).toBeCloseTo(6);
    });

    it('matches the existing final WPM and Raw WPM', () => {
        const session = createCorrectedSession();
        const summary = summarizeCompletedSession(session);

        const lastPoint = deriveSessionBehavioralResult(session).temporal.points.at(-1);

        expect(lastPoint?.elapsedMs).toBe(summary.durationMs);
        expect(lastPoint?.wpm).toBeCloseTo(summary.wpm);
        expect(lastPoint?.rawWpm).toBeCloseTo(summary.rawWpm);
    });

    it('preserves exact error timestamps and corrections', () => {
        const result = deriveSessionBehavioralResult(createCorrectedSession());

        expect(result.temporal.errorMarkers).toEqual([
            {
                sequence: 1,
                elapsedMs: 1_000,
                position: 1,
                expectedCharacter: 'b',
                enteredCharacter: 'x',
                corrected: true,
                correctionSequence: 2,
                correctionElapsedMs: 2_000,
            },
        ]);
    });

    it('associates repeated corrections with the original errors', () => {
        const session = completeSession('abc', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'x', timestampMs: 200 },
            { type: 'backspace', timestampMs: 300 },
            { type: 'insert', value: 'y', timestampMs: 400 },
            { type: 'backspace', timestampMs: 500 },
            { type: 'insert', value: 'b', timestampMs: 600 },
            { type: 'insert', value: 'c', timestampMs: 700 },
        ]);

        expect(session.status).toBe('completed');
        expect(session.events).toHaveLength(7);

        const markers = deriveSessionBehavioralResult(session).temporal.errorMarkers;

        expect(markers).toHaveLength(2);

        expect(markers[0]).toMatchObject({
            sequence: 1,
            elapsedMs: 100,
            position: 1,
            expectedCharacter: 'b',
            enteredCharacter: 'x',
            corrected: true,
            correctionSequence: 2,
            correctionElapsedMs: 200,
        });

        expect(markers[1]).toMatchObject({
            sequence: 3,
            elapsedMs: 300,
            position: 1,
            expectedCharacter: 'b',
            enteredCharacter: 'y',
            corrected: true,
            correctionSequence: 4,
            correctionElapsedMs: 400,
        });
    });

    it('preserves uncorrected errors', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'x', timestampMs: 200 },
        ]);

        expect(deriveSessionBehavioralResult(session).temporal.errorMarkers[0]).toMatchObject({
            corrected: false,
            correctionSequence: null,
            correctionElapsedMs: null,
        });
    });

    it('produces identical results from equivalent relative timelines', () => {
        const first = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 2_100 },
        ]);

        const second = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 5_100 },
            { type: 'insert', value: 'b', timestampMs: 7_100 },
        ]);

        expect(deriveSessionBehavioralResult(first)).toEqual(deriveSessionBehavioralResult(second));
    });

    it('preserves the original session and existing metrics', () => {
        const session = createCorrectedSession();
        const originalEvents = session.events.map((event) => ({
            ...event,
        }));
        const originalSummary = summarizeCompletedSession(session);

        const first = deriveSessionBehavioralResult(session);
        const second = deriveSessionBehavioralResult(session);

        expect(first).toEqual(second);
        expect(session.events).toEqual(originalEvents);
        expect(summarizeCompletedSession(session)).toEqual(originalSummary);
    });

    it('rejects inconsistent event sequences', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 200 },
        ]);

        const invalidSession: TypingSessionState = {
            ...session,
            events: session.events.map((event, index) =>
                index === 1 ? { ...event, sequence: 10 } : event,
            ),
        };

        expect(() => deriveSessionBehavioralResult(invalidSession)).toThrow(
            'Typing event sequence is invalid.',
        );
    });
});
