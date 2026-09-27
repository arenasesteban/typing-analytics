export type TypingSessionStatus = 'idle' | 'active' | 'completed';

export interface TypedCharacter {
    readonly position: number;
    readonly expectedCharacter: string;
    readonly enteredCharacter: string;
    readonly correct: boolean;
}

export interface CharacterInsertEvent {
    readonly type: 'insert';
    readonly sequence: number;
    readonly position: number;
    readonly expectedCharacter: string;
    readonly enteredCharacter: string;
    readonly correct: boolean;
    readonly timestampMs: number;
}

export interface BackspaceEvent {
    readonly type: 'backspace';
    readonly sequence: number;
    readonly position: number;
    readonly expectedCharacter: string;
    readonly removedCharacter: string;
    readonly removedCorrect: boolean;
    readonly timestampMs: number;
}

export type TypingEvent = CharacterInsertEvent | BackspaceEvent;

export type TypingInput =
    | {
          readonly type: 'insert';
          readonly value: string;
          readonly timestampMs: number;
      }
    | {
          readonly type: 'backspace';
          readonly timestampMs: number;
      };

export interface TypingSessionState {
    readonly targetText: string;
    readonly status: TypingSessionStatus;
    readonly currentPosition: number;
    readonly typedCharacters: readonly TypedCharacter[];
    readonly events: readonly TypingEvent[];
    readonly startedAtMs: number | null;
    readonly completedAtMs: number | null;
}
