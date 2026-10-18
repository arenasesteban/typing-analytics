import { createApiClient } from '../shared/http';
import { isHistoricalAnalyticsOverview } from './response';

import type { AnalyticsRange, HistoricalAnalyticsOverview } from './response';

export { ANALYTICS_RANGES } from './response';

export type {
    AnalyticsRange,
    HistoricalAnalyticsSummary,
    HistoricalAnalyticsTrendPoint,
    HistoricalAnalyticsOverview,
} from './response';

export class AnalyticsApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = 'AnalyticsApiError';
    }
}

const { requestJson } = createApiClient({
    ErrorClass: AnalyticsApiError,
    errorMessagePrefix: 'Analytics request failed',
    invalidResponseMessage: 'Analytics API returned an invalid response',
});

export async function getHistoricalAnalyticsOverview(
    accessToken: string,
    range: AnalyticsRange,
): Promise<HistoricalAnalyticsOverview> {
    const overview = await requestJson(
        `/analytics/overview?range=${encodeURIComponent(range)}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        },
        isHistoricalAnalyticsOverview,
    );

    if (overview.range !== range) {
        throw new Error('Analytics API returned an unexpected temporal range');
    }

    return overview;
}
