export const ANALYTICS_RANGES = ['7d', '30d', 'all'] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export const DEFAULT_ANALYTICS_RANGE: AnalyticsRange = '30d';

export const DAY_IN_MS = 24 * 60 * 60 * 1000;
