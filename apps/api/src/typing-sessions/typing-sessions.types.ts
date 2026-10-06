import type { TypingInput } from '@typing-analytics/typing-core';

export interface TypingTextResponse {
    readonly id: string;
    readonly text: string;
}

export interface CreatedTypingSessionResponse {
    readonly id: string;
    readonly typingText: TypingTextResponse;
}

export interface CompleteTypingSessionRequest {
    readonly inputs: readonly TypingInput[];
}

export interface PersistedTypingSessionResultResponse {
    readonly id: string;
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

export interface CompletedTypingSessionResponse extends PersistedTypingSessionResultResponse {
    readonly typingText: TypingTextResponse;
}

export type TypingSessionHistoryItemResponse = PersistedTypingSessionResultResponse;

export type TypingSessionHistoryDetailResponse = CompletedTypingSessionResponse;

export interface TypingSessionHistoryQuery {
    readonly page: number;
    readonly pageSize: number;
}

export interface TypingSessionHistoryPaginationResponse {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
}

export interface TypingSessionHistoryResponse {
    readonly items: readonly TypingSessionHistoryItemResponse[];
    readonly pagination: TypingSessionHistoryPaginationResponse;
}
