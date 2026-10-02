import { ENGLISH_WORD_CORPUS } from './english-word-corpus';

export const DEFAULT_TYPING_WORD_COUNT = 25;

export type RandomSource = () => number;

function assertValidCorpus(corpus: readonly string[]): void {
    if (corpus.length === 0) {
        throw new RangeError('Typing word corpus must contain at least one word.');
    }

    for (const word of corpus) {
        if (word.length === 0 || word.trim() !== word || /\s/u.test(word)) {
            throw new RangeError(
                'Typing word corpus entries must be non-empty words without whitespace.',
            );
        }
    }
}

function assertValidWordCount(wordCount: number): void {
    if (!Number.isInteger(wordCount) || wordCount <= 0) {
        throw new RangeError('Typing word count must be a positive integer.');
    }
}

function selectRandomWord(corpus: readonly string[], random: RandomSource): string {
    const randomValue = random();

    if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
        throw new RangeError('Random source must return a finite number in the range [0, 1).');
    }

    const index = Math.floor(randomValue * corpus.length);

    return corpus[index];
}

export function generateTypingText(
    corpus: readonly string[] = ENGLISH_WORD_CORPUS,
    wordCount: number = DEFAULT_TYPING_WORD_COUNT,
    random: RandomSource = Math.random,
): string {
    assertValidCorpus(corpus);
    assertValidWordCount(wordCount);

    const words = Array.from({ length: wordCount }, () => selectRandomWord(corpus, random));

    return words.join(' ');
}
