import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

import {
    ANALYTICS_RANGES,
    DEFAULT_ANALYTICS_RANGE,
    type AnalyticsRange,
} from './analytics.constants.js';
import type { AnalyticsOverviewQuery } from './analytics.types.js';

const ANALYTICS_QUERY_KEYS = new Set(['range']);
const ANALYTICS_RANGE_SET = new Set<string>(ANALYTICS_RANGES);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRange(value: unknown): AnalyticsRange {
    if (value === undefined) {
        return DEFAULT_ANALYTICS_RANGE;
    }

    if (typeof value !== 'string' || !ANALYTICS_RANGE_SET.has(value)) {
        throw new BadRequestException('range must be one of: 7d, 30d, all');
    }

    return value as AnalyticsRange;
}

@Injectable()
export class AnalyticsOverviewQueryPipe implements PipeTransform<unknown, AnalyticsOverviewQuery> {
    transform(value: unknown): AnalyticsOverviewQuery {
        if (!isRecord(value)) {
            throw new BadRequestException('Analytics query parameters must be an object');
        }

        for (const key of Object.keys(value)) {
            if (!ANALYTICS_QUERY_KEYS.has(key)) {
                throw new BadRequestException(`Unknown analytics query parameter: ${key}`);
            }
        }

        return {
            range: parseRange(value['range']),
        };
    }
}
