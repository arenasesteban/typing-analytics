import type { TypingInput } from '@typing-analytics/typing-core';

import { createApiClient } from '../shared/http';

import {
    isCompletedTypingSession,
    isCreatedTypingSession,
    isTypingSessionHistoryDetail,
    isTypingSessionHistoryResponse,
} from './response';

import type {
    CompletedTypingSession,
    CreatedTypingSession,
    TypingSessionHistoryDetail,
    TypingSessionHistoryResponse,
} from './response';

export type {
    TypingText,
    CreatedTypingSession,
    PersistedTypingSessionResult,
    CompletedTypingSession,
    TypingSessionHistoryItem,
    TypingSessionHistoryPagination,
    TypingSessionHistoryResponse,
    TypingSessionBehavioralResponse,
    TypingSessionHistoryDetail,
} from './response';

export class TypingSessionsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'TypingSessionsApiError';
    }
}

const { requestJson } = createApiClient({
    ErrorClass: TypingSessionsApiError,
    errorMessagePrefix: 'Typing session request failed',
    invalidResponseMessage: 'Typing session API returned an invalid response',
});

export function createTypingSession(accessToken: string): Promise<CreatedTypingSession> {
    return requestJson(
        '/typing-sessions',
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
        isCreatedTypingSession,
    );
}

export function completeTypingSession(
    accessToken: string,
    id: string,
    inputs: readonly TypingInput[],
): Promise<CompletedTypingSession> {
    return requestJson(
        `/typing-sessions/${encodeURIComponent(id)}/complete`,
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                inputs,
            }),
        },
        isCompletedTypingSession,
    );
}

export function getTypingSessionHistory(
    accessToken: string,
    page: number,
    pageSize: number,
): Promise<TypingSessionHistoryResponse> {
    const searchParams = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
    });

    return requestJson(
        `/typing-sessions?${searchParams.toString()}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
        isTypingSessionHistoryResponse,
    );
}

export function getTypingSessionHistoryDetail(
    accessToken: string,
    id: string,
): Promise<TypingSessionHistoryDetail> {
    return requestJson(
        `/typing-sessions/${encodeURIComponent(id)}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
        isTypingSessionHistoryDetail,
    );
}
