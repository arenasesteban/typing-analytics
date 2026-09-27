import { describe, expect, it } from 'vitest';

import { applyTypingInput, createTypingSession } from './session';

describe('createTypingSession', () => {
    it('creates a deterministic idle session', () => {
        const session = createTypingSession('abc');

        expect(session).toEqual({
            targetText: 'abc',
            status: 'idle',
            currentPosition: 0,
            typedCharacters: [],
            events: [],
            startedAtMs: null,
            completedAtMs: null,
        });
    });

    it('rejects an empty target text', () => {
        expect(() => createTypingSession('')).toThrow(RangeError);
    });
});

describe('applyTypingInput', () => {
    it('starts the session on the first valid character insertion', () => {
        const session = createTypingSession('abc');

        const next = applyTypingInput(session, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        expect(next.status).toBe('active');
        expect(next.currentPosition).toBe(1);
        expect(next.startedAtMs).toBe(100);
        expect(next.completedAtMs).toBeNull();

        expect(next.typedCharacters).toEqual([
            {
                position: 0,
                expectedCharacter: 'a',
                enteredCharacter: 'a',
                correct: true,
            },
        ]);

        expect(next.events).toEqual([
            {
                type: 'insert',
                sequence: 0,
                position: 0,
                expectedCharacter: 'a',
                enteredCharacter: 'a',
                correct: true,
                timestampMs: 100,
            },
        ]);
    });

    it('advances after a correct character insertion', () => {
        const initial = createTypingSession('abcd');

        const first = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        const second = applyTypingInput(first, {
            type: 'insert',
            value: 'b',
            timestampMs: 120,
        });

        expect(second.status).toBe('active');
        expect(second.currentPosition).toBe(2);

        expect(second.typedCharacters.at(-1)).toEqual({
            position: 1,
            expectedCharacter: 'b',
            enteredCharacter: 'b',
            correct: true,
        });
    });

    it('advances and records an incorrect character insertion', () => {
        const session = createTypingSession('abc');

        const next = applyTypingInput(session, {
            type: 'insert',
            value: 'x',
            timestampMs: 100,
        });

        expect(next.status).toBe('active');
        expect(next.currentPosition).toBe(1);

        expect(next.typedCharacters).toEqual([
            {
                position: 0,
                expectedCharacter: 'a',
                enteredCharacter: 'x',
                correct: false,
            },
        ]);
    });

    it('records repeated incorrect insertions at consecutive positions', () => {
        const initial = createTypingSession('abcd');

        const first = applyTypingInput(initial, {
            type: 'insert',
            value: 'x',
            timestampMs: 100,
        });

        const second = applyTypingInput(first, {
            type: 'insert',
            value: 'y',
            timestampMs: 120,
        });

        expect(second.currentPosition).toBe(2);

        expect(second.typedCharacters).toEqual([
            {
                position: 0,
                expectedCharacter: 'a',
                enteredCharacter: 'x',
                correct: false,
            },
            {
                position: 1,
                expectedCharacter: 'b',
                enteredCharacter: 'y',
                correct: false,
            },
        ]);
    });

    it('removes the latest current character with Backspace while preserving history', () => {
        const initial = createTypingSession('abc');

        const afterA = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        const afterWrongCharacter = applyTypingInput(afterA, {
            type: 'insert',
            value: 'x',
            timestampMs: 120,
        });

        const afterBackspace = applyTypingInput(afterWrongCharacter, {
            type: 'backspace',
            timestampMs: 140,
        });

        expect(afterBackspace.status).toBe('active');
        expect(afterBackspace.currentPosition).toBe(1);

        expect(afterBackspace.typedCharacters).toEqual([
            {
                position: 0,
                expectedCharacter: 'a',
                enteredCharacter: 'a',
                correct: true,
            },
        ]);

        expect(afterBackspace.events).toHaveLength(3);

        expect(afterBackspace.events[1]).toMatchObject({
            type: 'insert',
            enteredCharacter: 'x',
            correct: false,
        });

        expect(afterBackspace.events[2]).toEqual({
            type: 'backspace',
            sequence: 2,
            position: 1,
            expectedCharacter: 'b',
            removedCharacter: 'x',
            removedCorrect: false,
            timestampMs: 140,
        });

        const corrected = applyTypingInput(afterBackspace, {
            type: 'insert',
            value: 'b',
            timestampMs: 160,
        });

        expect(corrected.currentPosition).toBe(2);
        expect(corrected.events).toHaveLength(4);

        expect(corrected.typedCharacters.at(-1)).toEqual({
            position: 1,
            expectedCharacter: 'b',
            enteredCharacter: 'b',
            correct: true,
        });
    });

    it('does not reset the session when Backspace returns to position zero', () => {
        const initial = createTypingSession('abc');

        const active = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        const backspaced = applyTypingInput(active, {
            type: 'backspace',
            timestampMs: 120,
        });

        expect(backspaced.status).toBe('active');
        expect(backspaced.currentPosition).toBe(0);
        expect(backspaced.startedAtMs).toBe(100);
        expect(backspaced.completedAtMs).toBeNull();
    });

    it('ignores empty and non-character insertions', () => {
        const initial = createTypingSession('abc');

        const empty = applyTypingInput(initial, {
            type: 'insert',
            value: '',
            timestampMs: 100,
        });

        const nonCharacter = applyTypingInput(initial, {
            type: 'insert',
            value: 'Enter',
            timestampMs: 100,
        });

        expect(empty).toBe(initial);
        expect(nonCharacter).toBe(initial);
    });

    it('ignores Backspace before the session starts', () => {
        const initial = createTypingSession('abc');

        const next = applyTypingInput(initial, {
            type: 'backspace',
            timestampMs: 100,
        });

        expect(next).toBe(initial);
    });

    it('completes when an insertion fills the final target position', () => {
        const initial = createTypingSession('ab');

        const first = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        const completed = applyTypingInput(first, {
            type: 'insert',
            value: 'x',
            timestampMs: 150,
        });

        expect(completed.status).toBe('completed');
        expect(completed.currentPosition).toBe(2);
        expect(completed.startedAtMs).toBe(100);
        expect(completed.completedAtMs).toBe(150);

        expect(completed.typedCharacters.at(-1)).toEqual({
            position: 1,
            expectedCharacter: 'b',
            enteredCharacter: 'x',
            correct: false,
        });
    });

    it('completes a one-character target on its first valid insertion', () => {
        const initial = createTypingSession('a');

        const completed = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        expect(completed.status).toBe('completed');
        expect(completed.currentPosition).toBe(1);
        expect(completed.startedAtMs).toBe(100);
        expect(completed.completedAtMs).toBe(100);
    });

    it('ignores every normal transition after completion', () => {
        const initial = createTypingSession('a');

        const completed = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        const insertAfterCompletion = applyTypingInput(completed, {
            type: 'insert',
            value: 'b',
            timestampMs: 120,
        });

        const backspaceAfterCompletion = applyTypingInput(completed, {
            type: 'backspace',
            timestampMs: 120,
        });

        expect(insertAfterCompletion).toBe(completed);
        expect(backspaceAfterCompletion).toBe(completed);
    });

    it('rejects non-monotonic timestamps without mutating the session', () => {
        const initial = createTypingSession('abc');

        const active = applyTypingInput(initial, {
            type: 'insert',
            value: 'a',
            timestampMs: 100,
        });

        expect(() =>
            applyTypingInput(active, {
                type: 'insert',
                value: 'b',
                timestampMs: 99,
            }),
        ).toThrow(RangeError);

        expect(active.currentPosition).toBe(1);
        expect(active.events).toHaveLength(1);
    });

    it('rejects non-finite timestamps for accepted inputs', () => {
        const initial = createTypingSession('abc');

        expect(() =>
            applyTypingInput(initial, {
                type: 'insert',
                value: 'a',
                timestampMs: Number.NaN,
            }),
        ).toThrow(RangeError);
    });
});
