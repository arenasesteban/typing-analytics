import type {
    BackspaceEvent,
    CharacterInsertEvent,
    TypedCharacter,
    TypingInput,
    TypingSessionState,
} from './session.types';

function toCharacters(value: string): string[] {
    return Array.from(value);
}

function isSingleCharacter(value: string): boolean {
    return toCharacters(value).length === 1;
}

function assertValidTimestamp(state: TypingSessionState, timestampMs: number): void {
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
        throw new RangeError('Typing input timestamp must be a finite, non-negative number.');
    }

    const previousEvent = state.events.at(-1);

    if (previousEvent !== undefined && timestampMs < previousEvent.timestampMs) {
        throw new RangeError('Typing input timestamps must be monotonically non-decreasing.');
    }
}

export function createTypingSession(targetText: string): TypingSessionState {
    if (toCharacters(targetText).length === 0) {
        throw new RangeError('Target text must contain at least one character.');
    }

    return {
        targetText,
        status: 'idle',
        currentPosition: 0,
        typedCharacters: [],
        events: [],
        startedAtMs: null,
        completedAtMs: null,
    };
}

function applyCharacterInsert(
    state: TypingSessionState,
    value: string,
    timestampMs: number,
): TypingSessionState {
    if (!isSingleCharacter(value)) {
        return state;
    }

    assertValidTimestamp(state, timestampMs);

    const targetCharacters = toCharacters(state.targetText);
    const expectedCharacter = targetCharacters[state.currentPosition];

    const typedCharacter: TypedCharacter = {
        position: state.currentPosition,
        expectedCharacter,
        enteredCharacter: value,
        correct: value === expectedCharacter,
    };

    const event: CharacterInsertEvent = {
        type: 'insert',
        sequence: state.events.length,
        position: state.currentPosition,
        expectedCharacter,
        enteredCharacter: value,
        correct: value === expectedCharacter,
        timestampMs,
    };

    const nextPosition = state.currentPosition + 1;
    const completed = nextPosition === targetCharacters.length;

    return {
        ...state,
        status: completed ? 'completed' : 'active',
        currentPosition: nextPosition,
        typedCharacters: [...state.typedCharacters, typedCharacter],
        events: [...state.events, event],
        startedAtMs: state.startedAtMs ?? timestampMs,
        completedAtMs: completed ? timestampMs : null,
    };
}

function applyBackspace(state: TypingSessionState, timestampMs: number): TypingSessionState {
    if (state.status !== 'active' || state.currentPosition === 0) {
        return state;
    }

    assertValidTimestamp(state, timestampMs);

    const removedCharacter = state.typedCharacters.at(-1);

    if (removedCharacter === undefined) {
        return state;
    }

    const event: BackspaceEvent = {
        type: 'backspace',
        sequence: state.events.length,
        position: removedCharacter.position,
        expectedCharacter: removedCharacter.expectedCharacter,
        removedCharacter: removedCharacter.enteredCharacter,
        removedCorrect: removedCharacter.correct,
        timestampMs,
    };

    return {
        ...state,
        currentPosition: state.currentPosition - 1,
        typedCharacters: state.typedCharacters.slice(0, -1),
        events: [...state.events, event],
    };
}

export function applyTypingInput(
    state: TypingSessionState,
    input: TypingInput,
): TypingSessionState {
    if (state.status === 'completed') {
        return state;
    }

    if (input.type === 'insert') {
        return applyCharacterInsert(state, input.value, input.timestampMs);
    }

    return applyBackspace(state, input.timestampMs);
}
