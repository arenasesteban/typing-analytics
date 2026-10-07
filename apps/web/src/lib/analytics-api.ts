export const ANALYTICS_RANGES = ['7d', '30d', 'all'] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export interface HistoricalAnalyticsSummary {
    readonly sessionCount: number;
    readonly recentWpm: number | null;
    readonly recentAccuracy: number | null;
    readonly consistency: number | null;
}

export interface HistoricalAnalyticsTrendPoint {
    readonly completedAt: string;
    readonly wpm: number;
    readonly accuracy: number;
}

export interface HistoricalAnalyticsOverview {
    readonly range: AnalyticsRange;
    readonly summary: HistoricalAnalyticsSummary;
    readonly trends: readonly HistoricalAnalyticsTrendPoint[];
}

export class AnalyticsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AnalyticsApiError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
    return value === null || isFiniteNumber(value);
}

function isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isDateTimeString(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isAnalyticsRange(value: unknown): value is AnalyticsRange {
    return typeof value === 'string' && ANALYTICS_RANGES.includes(value as AnalyticsRange);
}

function isTrendPoint(value: unknown): value is HistoricalAnalyticsTrendPoint {
    return (
        isRecord(value) &&
        isDateTimeString(value['completedAt']) &&
        isFiniteNumber(value['wpm']) &&
        isFiniteNumber(value['accuracy'])
    );
}

function isAnalyticsSummary(value: unknown): value is HistoricalAnalyticsSummary {
    return (
        isRecord(value) &&
        isNonNegativeInteger(value['sessionCount']) &&
        isNullableFiniteNumber(value['recentWpm']) &&
        isNullableFiniteNumber(value['recentAccuracy']) &&
        isNullableFiniteNumber(value['consistency'])
    );
}

function isHistoricalAnalyticsOverview(value: unknown): value is HistoricalAnalyticsOverview {
    if (
        !isRecord(value) ||
        !isAnalyticsRange(value['range']) ||
        !isAnalyticsSummary(value['summary']) ||
        !Array.isArray(value['trends']) ||
        !value['trends'].every(isTrendPoint)
    ) {
        return false;
    }

    const summary = value['summary'];
    const trends = value['trends'];

    if (summary.sessionCount === 0) {
        return (
            summary.recentWpm === null &&
            summary.recentAccuracy === null &&
            summary.consistency === null &&
            trends.length === 0
        );
    }

    return (
        summary.recentWpm !== null &&
        summary.recentAccuracy !== null &&
        summary.consistency !== null &&
        trends.length === summary.sessionCount
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

    return `Analytics request failed with status ${String(status)}`;
}

export async function getHistoricalAnalyticsOverview(
    accessToken: string,
    range: AnalyticsRange,
): Promise<HistoricalAnalyticsOverview> {
    const response = await fetch(
        `${getApiBaseUrl()}/analytics/overview?range=${encodeURIComponent(range)}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
    );

    const body = await readResponseBody(response);

    if (!response.ok) {
        throw new AnalyticsApiError(getErrorMessage(body, response.status), response.status);
    }

    if (!isHistoricalAnalyticsOverview(body)) {
        throw new Error('Analytics API returned an invalid response');
    }

    if (body.range !== range) {
        throw new Error('Analytics API returned an unexpected temporal range');
    }

    return body;
}
