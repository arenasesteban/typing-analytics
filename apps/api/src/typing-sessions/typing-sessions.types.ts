import type { TypingInput } from '@typing-analytics/typing-core';

export interface CreatedTypingSessionResponse {
    readonly id: string;
    readonly typingText: {
        readonly id: string;
        readonly text: string;
    };
}

export interface CompleteTypingSessionRequest {
    readonly inputs: readonly TypingInput[];
}

export interface CompletedTypingSessionResponse {
    readonly id: string;
    readonly typingText: {
        readonly id: string;
        readonly text: string;
    };
    readonly durationMs: number;
    readonly wpm: number;
    readonly rawWpm: number;
    readonly accuracy: number;
    readonly consistency: number;
    readonly totalInputs: number;
    readonly correctInputs: number;
    readonly incorrectInputs: number;
    readonly startedAt: string;
    readonly completedAt: string;
}
