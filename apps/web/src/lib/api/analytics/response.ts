import {
    isDateTimeString,
    isFiniteNumber,
    isNonNegativeInteger,
    isNullableFiniteNumber,
    isRecord,
} from '../shared/validation';

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

function isAnalyticsRange(value: unknown): value is AnalyticsRange {
    return typeof value === 'string' && ANALYTICS_RANGES.includes(value as AnalyticsRange);
}

function isHistoricalAnalyticsTrendPoint(value: unknown): value is HistoricalAnalyticsTrendPoint {
    return (
        isRecord(value) &&
        isDateTimeString(value['completedAt']) &&
        isFiniteNumber(value['wpm']) &&
        isFiniteNumber(value['accuracy'])
    );
}

function isHistoricalAnalyticsSummary(value: unknown): value is HistoricalAnalyticsSummary {
    return (
        isRecord(value) &&
        isNonNegativeInteger(value['sessionCount']) &&
        isNullableFiniteNumber(value['recentWpm']) &&
        isNullableFiniteNumber(value['recentAccuracy']) &&
        isNullableFiniteNumber(value['consistency'])
    );
}

export function isHistoricalAnalyticsOverview(
    value: unknown,
): value is HistoricalAnalyticsOverview {
    if (
        !isRecord(value) ||
        !isAnalyticsRange(value['range']) ||
        !isHistoricalAnalyticsSummary(value['summary']) ||
        !Array.isArray(value['trends']) ||
        !value['trends'].every(isHistoricalAnalyticsTrendPoint)
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
