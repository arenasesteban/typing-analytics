import type { AnalyticsRange } from './analytics.constants.js';

export interface AnalyticsOverviewQuery {
    readonly range: AnalyticsRange;
}

export interface AnalyticsOverviewSummaryResponse {
    readonly sessionCount: number;
    readonly recentWpm: number | null;
    readonly recentAccuracy: number | null;
    readonly consistency: number | null;
}

export interface AnalyticsOverviewTrendPointResponse {
    readonly completedAt: string;
    readonly wpm: number;
    readonly accuracy: number;
}

export interface AnalyticsOverviewResponse {
    readonly range: AnalyticsRange;
    readonly summary: AnalyticsOverviewSummaryResponse;
    readonly trends: readonly AnalyticsOverviewTrendPointResponse[];
}
