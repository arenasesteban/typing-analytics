import { describe, expect, it } from 'vitest';

import { summarizeCompletedSession } from '../metrics';
import { applyTypingInput, createTypingSession } from '../session';
import type { TypingInput, TypingSessionState } from '../session';
import { DEFAULT_BEHAVIORAL_OPTIONS, deriveSessionBehavioralResult } from './behavioral';

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
    it('rejects sessions that have not been completed', () => {
        const session = createTypingSession('abc');

        expect(() => deriveSessionBehavioralResult(session)).toThrow(
            'Only completed typing sessions can be summarized.',
        );
    });

    it('uses the approved default policy', () => {
        const result = deriveSessionBehavioralResult(createCorrectedSession());

        expect(result.temporal.windowMs).toBe(DEFAULT_BEHAVIORAL_OPTIONS.windowMs);

        expect(result.characterPolicy).toEqual({
            minimumSample: 5,
            errorRateThresholdPct: 30,
        });
    });

    it('produces deterministic results without changing the session', () => {
        const session = createCorrectedSession();
        const originalEvents = session.events.map((event) => ({
            ...event,
        }));

        const first = deriveSessionBehavioralResult(session);
        const second = deriveSessionBehavioralResult(session);

        expect(first).toEqual(second);
        expect(session.events).toEqual(originalEvents);
    });

    it('preserves the existing completed-session summary', () => {
        const session = createCorrectedSession();
        const before = summarizeCompletedSession(session);

        deriveSessionBehavioralResult(session);

        expect(summarizeCompletedSession(session)).toEqual(before);
        expect(before.totalInputs).toBe(4);
        expect(before.correctInputs).toBe(3);
        expect(before.incorrectInputs).toBe(1);
        expect(before.latenciesMs).toEqual([1_000, 1_000, 1_000, 3_000]);
    });

    it('matches the final WPM and Raw WPM summary values', () => {
        const session = createCorrectedSession();
        const summary = summarizeCompletedSession(session);

        const result = deriveSessionBehavioralResult(session, {
            windowMs: 2_000,
        });

        const finalPoint = result.temporal.points.at(-1);

        expect(finalPoint?.elapsedMs).toBe(summary.durationMs);
        expect(finalPoint?.cumulativeWpm).toBeCloseTo(summary.wpm);
        expect(finalPoint?.cumulativeRawWpm).toBeCloseTo(summary.rawWpm);
    });

    it('calculates cumulative and window-based performance', () => {
        const result = deriveSessionBehavioralResult(createCorrectedSession(), { windowMs: 2_000 });

        const points = result.temporal.points;

        expect(points.map((point) => point.elapsedMs)).toEqual([0, 2_000, 4_000, 6_000]);

        expect(points[1].windowWpm).toBeCloseTo(6);
        expect(points[1].windowRawWpm).toBeCloseTo(12);

        expect(points[2].cumulativeWpm).toBeCloseTo(6);
        expect(points[2].cumulativeRawWpm).toBeCloseTo(9);

        expect(points[3].cumulativeWpm).toBeCloseTo(6);
        expect(points[3].cumulativeRawWpm).toBeCloseTo(8);
    });

    it('includes insertions exactly on the right window boundary', () => {
        const session = completeSession('abc', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 2_100 },
            { type: 'insert', value: 'c', timestampMs: 4_100 },
        ]);

        const result = deriveSessionBehavioralResult(session, {
            windowMs: 2_000,
        });

        expect(result.temporal.points[1].windowWpm).toBeCloseTo(12);
        expect(result.temporal.points[2].windowWpm).toBeCloseTo(6);
    });

    it('uses the actual duration of a partial final window', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 2_600 },
        ]);

        const result = deriveSessionBehavioralResult(session, {
            windowMs: 2_000,
        });

        const finalPoint = result.temporal.points.at(-1);

        expect(finalPoint?.windowDurationMs).toBe(500);
        expect(finalPoint?.windowWpm).toBeCloseTo(24);
        expect(finalPoint?.cumulativeWpm).toBeCloseTo(9.6);
    });

    it('returns zero for windows without insertions', () => {
        const session = completeSession('abc', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 7_100 },
            { type: 'insert', value: 'c', timestampMs: 10_100 },
        ]);

        const result = deriveSessionBehavioralResult(session, {
            windowMs: 2_000,
        });

        expect(result.temporal.points[2].windowWpm).toBe(0);
        expect(result.temporal.points[2].windowRawWpm).toBe(0);
        expect(result.temporal.points[3].windowWpm).toBe(0);
    });

    it('handles zero-duration sessions without invalid rates', () => {
        const session = completeSession('a', [{ type: 'insert', value: 'a', timestampMs: 100 }]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.points).toHaveLength(1);
        expect(result.temporal.points[0]).toMatchObject({
            elapsedMs: 0,
            cumulativeWpm: 0,
            cumulativeRawWpm: 0,
            windowWpm: 0,
            windowRawWpm: 0,
        });

        expect(result.characters[0].sampleCount).toBe(1);
    });

    it('allows equal timestamps without changing existing timing rules', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 100 },
        ]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.points[0].cumulativeWpm).toBe(0);
        expect(result.characters).toHaveLength(2);
    });

    it('keeps incorrect insertions after a Backspace correction', () => {
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

    it('associates repeated corrections with the correct insertion', () => {
        const session = completeSession('abc', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'x', timestampMs: 200 },
            { type: 'backspace', timestampMs: 300 },
            { type: 'insert', value: 'y', timestampMs: 400 },
            { type: 'backspace', timestampMs: 500 },
            { type: 'insert', value: 'b', timestampMs: 600 },
            { type: 'insert', value: 'c', timestampMs: 700 },
        ]);

        const result = deriveSessionBehavioralResult(session);
        const markers = result.temporal.errorMarkers;

        expect(session.status).toBe('completed');

        expect(markers).toHaveLength(2);

        expect(markers[0]).toMatchObject({
            sequence: 1,
            position: 1,
            expectedCharacter: 'b',
            enteredCharacter: 'x',
            corrected: true,
            correctionSequence: 2,
        });

        expect(markers[1]).toMatchObject({
            sequence: 3,
            position: 1,
            expectedCharacter: 'b',
            enteredCharacter: 'y',
            corrected: true,
            correctionSequence: 4,
        });

        const characterB = result.characters.find(
            (character) => character.expectedCharacter === 'b',
        );

        expect(characterB?.sampleCount).toBe(3);
        expect(characterB?.correctInputs).toBe(1);
        expect(characterB?.incorrectInputs).toBe(2);
    });

    it('does not mark an uncorrected error as corrected', () => {
        const session = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'x', timestampMs: 200 },
        ]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.temporal.errorMarkers[0]).toMatchObject({
            corrected: false,
            correctionSequence: null,
            correctionElapsedMs: null,
        });
    });

    it('groups attempts by expected character, including corrected errors', () => {
        const result = deriveSessionBehavioralResult(createCorrectedSession(), {
            minimumSample: 2,
            errorRateThresholdPct: 40,
        });

        const characterB = result.characters.find(
            (character) => character.expectedCharacter === 'b',
        );

        expect(characterB).toEqual({
            expectedCharacter: 'b',
            sampleCount: 2,
            correctInputs: 1,
            incorrectInputs: 1,
            errorRate: 50,
            accuracy: 50,
            sufficientSample: true,
            problematic: true,
        });

        const characterA = result.characters.find(
            (character) => character.expectedCharacter === 'a',
        );

        expect(characterA?.sufficientSample).toBe(false);
        expect(characterA?.problematic).toBeNull();
    });

    it('classifies a character only with sufficient evidence', () => {
        const session = completeSession('aaaaa', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'x', timestampMs: 200 },
            { type: 'insert', value: 'x', timestampMs: 300 },
            { type: 'insert', value: 'a', timestampMs: 400 },
            { type: 'insert', value: 'a', timestampMs: 500 },
        ]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.characters[0]).toMatchObject({
            sampleCount: 5,
            incorrectInputs: 2,
            errorRate: 40,
            accuracy: 60,
            sufficientSample: true,
            problematic: true,
        });
    });

    it('distinguishes good performance from insufficient evidence', () => {
        const session = completeSession('aaaaa', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'a', timestampMs: 200 },
            { type: 'insert', value: 'a', timestampMs: 300 },
            { type: 'insert', value: 'a', timestampMs: 400 },
            { type: 'insert', value: 'a', timestampMs: 500 },
        ]);

        const result = deriveSessionBehavioralResult(session);

        expect(result.characters[0].sufficientSample).toBe(true);
        expect(result.characters[0].problematic).toBe(false);
        expect(result.characters[0].accuracy).toBe(100);
    });

    it('produces equivalent results for equivalent relative timestamps', () => {
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

    it('does not combine statistics from different sessions', () => {
        const first = createCorrectedSession();

        const second = completeSession('ab', [
            { type: 'insert', value: 'a', timestampMs: 100 },
            { type: 'insert', value: 'b', timestampMs: 200 },
        ]);

        const original = deriveSessionBehavioralResult(first);

        deriveSessionBehavioralResult(second);

        expect(deriveSessionBehavioralResult(first)).toEqual(original);
        expect(original.temporal.errorMarkers).toHaveLength(1);
    });

    it('rejects invalid configuration', () => {
        const session = createCorrectedSession();

        expect(() => deriveSessionBehavioralResult(session, { windowMs: 0 })).toThrow(RangeError);

        expect(() =>
            deriveSessionBehavioralResult(session, {
                minimumSample: 0,
            }),
        ).toThrow(RangeError);

        expect(() =>
            deriveSessionBehavioralResult(session, {
                errorRateThresholdPct: 101,
            }),
        ).toThrow(RangeError);

        expect(() =>
            deriveSessionBehavioralResult(session, {
                windowMs: Number.POSITIVE_INFINITY,
            }),
        ).toThrow(RangeError);
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
