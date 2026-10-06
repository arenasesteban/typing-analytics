import type { TypingInput } from '@typing-analytics/typing-core';

export interface TypingText {
    readonly id: string;
    readonly text: string;
}

export interface CreatedTypingSession {
    readonly id: string;
    readonly typingText: TypingText;
}

export interface PersistedTypingSessionResult {
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

export interface CompletedTypingSession extends PersistedTypingSessionResult {
    readonly typingText: TypingText;
}

export type TypingSessionHistoryItem = PersistedTypingSessionResult;

export interface TypingSessionHistoryPagination {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
}

export interface TypingSessionHistoryResponse {
    readonly items: readonly TypingSessionHistoryItem[];
    readonly pagination: TypingSessionHistoryPagination;
}

export type TypingSessionHistoryDetail = CompletedTypingSession;

export class TypingSessionsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'TypingSessionsApiError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
    return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && typeof value === 'number' && value > 0;
}

function isDateTimeString(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isTypingText(value: unknown): value is TypingText {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        typeof value['text'] === 'string' &&
        value['id'].length > 0 &&
        value['text'].length > 0
    );
}

function isCreatedTypingSession(value: unknown): value is CreatedTypingSession {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        isTypingText(value['typingText'])
    );
}

function isPersistedTypingSessionResult(value: unknown): value is PersistedTypingSessionResult {
    return (
        isRecord(value) &&
        typeof value['id'] === 'string' &&
        value['id'].length > 0 &&
        isFiniteNumber(value['durationMs']) &&
        value['durationMs'] >= 0 &&
        isFiniteNumber(value['wpm']) &&
        isFiniteNumber(value['rawWpm']) &&
        isFiniteNumber(value['accuracy']) &&
        isFiniteNumber(value['consistency']) &&
        isNonNegativeInteger(value['totalInputs']) &&
        isNonNegativeInteger(value['correctInputs']) &&
        isNonNegativeInteger(value['incorrectInputs']) &&
        isDateTimeString(value['startedAt']) &&
        isDateTimeString(value['completedAt'])
    );
}

function isCompletedTypingSession(value: unknown): value is CompletedTypingSession {
    return (
        isRecord(value) &&
        isPersistedTypingSessionResult(value) &&
        isTypingText(value['typingText'])
    );
}

function isTypingSessionHistoryPagination(value: unknown): value is TypingSessionHistoryPagination {
    return (
        isRecord(value) &&
        isPositiveInteger(value['page']) &&
        isPositiveInteger(value['pageSize']) &&
        isNonNegativeInteger(value['totalItems']) &&
        isNonNegativeInteger(value['totalPages'])
    );
}

function isTypingSessionHistoryResponse(value: unknown): value is TypingSessionHistoryResponse {
    return (
        isRecord(value) &&
        Array.isArray(value['items']) &&
        value['items'].every(isPersistedTypingSessionResult) &&
        isTypingSessionHistoryPagination(value['pagination'])
    );
}

function getApiBaseUrl(): string {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (configuredBaseUrl === undefined || configuredBaseUrl.trim().length === 0) {
        throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(configuredBaseUrl);
    } catch {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS URL');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS URL');
    }

    return parsedUrl.toString().replace(/\/+$/, '');
}

async function readResponseBody(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function getErrorMessage(body: unknown, status: number): string {
    if (isRecord(body)) {
        const message = body['message'];

        if (typeof message === 'string' && message.length > 0) {
            return message;
        }

        if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
            return message.join(', ');
        }
    }

    return `Typing session request failed with status ${String(status)}`;
}

async function requestJson<T>(
    path: string,
    init: RequestInit,
    isExpectedResponse: (value: unknown) => value is T,
): Promise<T> {
    const response = await fetch(`${getApiBaseUrl()}${path}`, init);

    const body = await readResponseBody(response);

    if (!response.ok) {
        throw new TypingSessionsApiError(getErrorMessage(body, response.status), response.status);
    }

    if (!isExpectedResponse(body)) {
        throw new Error('Typing session API returned an invalid response');
    }

    return body;
}

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
        isCompletedTypingSession,
    );
}
