import { describe, expect, it } from 'vitest';

import { ENGLISH_WORD_CORPUS } from './english-word-corpus';
import { DEFAULT_TYPING_WORD_COUNT, generateTypingText } from './typing-text';

describe('generateTypingText', () => {
    it('generates the default number of words', () => {
        const text = generateTypingText();
        const words = text.split(' ');

        expect(words).toHaveLength(DEFAULT_TYPING_WORD_COUNT);
    });

    it('selects every generated word from the approved corpus', () => {
        const text = generateTypingText();
        const words = text.split(' ');
        const approvedWords = new Set<string>(ENGLISH_WORD_CORPUS);

        expect(words.every((word) => approvedWords.has(word))).toBe(true);
    });

    it('joins generated words with exactly one space', () => {
        const text = generateTypingText(['alpha', 'beta'], 3, () => 0);

        expect(text).toBe('alpha alpha alpha');
        expect(text).toBe(text.trim());
        expect(text).not.toContain('  ');
    });

    it('is deterministic when the random source is controlled', () => {
        const randomValues = [0, 0.34, 0.67];
        let currentIndex = 0;

        const text = generateTypingText(
            ['alpha', 'beta', 'gamma'],
            3,
            () => randomValues[currentIndex++] ?? 0,
        );

        expect(text).toBe('alpha beta gamma');
    });

    it('rejects an empty corpus', () => {
        expect(() => generateTypingText([], 1, () => 0)).toThrow(RangeError);
    });

    it('rejects empty corpus entries', () => {
        expect(() => generateTypingText(['alpha', ''], 1, () => 0)).toThrow(RangeError);
    });

    it('rejects corpus entries containing whitespace', () => {
        expect(() => generateTypingText(['alpha', 'two words'], 1, () => 0)).toThrow(RangeError);
    });

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        'rejects invalid word count %s',
        (wordCount) => {
            expect(() => generateTypingText(['alpha'], wordCount, () => 0)).toThrow(RangeError);
        },
    );

    it.each([-0.1, 1, Number.NaN, Number.POSITIVE_INFINITY])(
        'rejects invalid random value %s',
        (randomValue) => {
            expect(() => generateTypingText(['alpha'], 1, () => randomValue)).toThrow(RangeError);
        },
    );
});
