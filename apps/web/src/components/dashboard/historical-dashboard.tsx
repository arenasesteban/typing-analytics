'use client';

import { IconActivity, IconGauge, IconHistory, IconTarget, type Icon } from '@tabler/icons-react';
import { useEffect, useId, useState } from 'react';

import { useAuth } from '@/auth/use-auth';
import {
    getHistoricalAnalyticsOverview,
    type AnalyticsRange,
    type HistoricalAnalyticsOverview,
} from '@/lib/analytics-api';

type DashboardLoadStatus = 'loading' | 'ready' | 'error';

interface DashboardRequestState {
    readonly requestKey: string;
    readonly status: DashboardLoadStatus;
    readonly overview: HistoricalAnalyticsOverview | null;
}

interface DashboardMetricProps {
    readonly label: string;
    readonly value: string;
    readonly testId: string;
    readonly icon: Icon;
}

interface TrendChartProps {
    readonly label: string;
    readonly values: readonly number[];
    readonly icon: Icon;
}

const RANGE_OPTIONS: readonly {
    value: AnalyticsRange;
    label: string;
}[] = [
    {
        value: '7d',
        label: 'Last 7 days',
    },
    {
        value: '30d',
        label: 'Last 30 days',
    },
    {
        value: 'all',
        label: 'All time',
    },
];

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

const CHART_WIDTH = 100;
const CHART_HEIGHT = 32;
const CHART_PADDING = 2;

function formatNumber(value: number | null): string {
    if (value === null) {
        return '—';
    }

    return NUMBER_FORMATTER.format(value);
}

function formatPercentage(value: number | null): string {
    if (value === null) {
        return '—';
    }

    return `${NUMBER_FORMATTER.format(value)}%`;
}

function formatTimestamp(value: string): string {
    return DATE_TIME_FORMATTER.format(new Date(value));
}

function buildPolylinePoints(values: readonly number[]): string {
    if (values.length === 0) {
        return '';
    }

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const valueRange = maximum - minimum;

    return values
        .map((value, index) => {
            const x =
                values.length === 1
                    ? CHART_WIDTH / 2
                    : CHART_PADDING +
                      (index * (CHART_WIDTH - CHART_PADDING * 2)) / (values.length - 1);

            const y =
                valueRange === 0
                    ? CHART_HEIGHT / 2
                    : CHART_PADDING +
                      ((maximum - value) * (CHART_HEIGHT - CHART_PADDING * 2)) / valueRange;

            return `${String(x)},${String(y)}`;
        })
        .join(' ');
}

function getChartCoordinates(values: readonly number[]): readonly {
    readonly x: number;
    readonly y: number;
}[] {
    if (values.length === 0) {
        return [];
    }

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const valueRange = maximum - minimum;

    return values.map((value, index) => ({
        x:
            values.length === 1
                ? CHART_WIDTH / 2
                : CHART_PADDING + (index * (CHART_WIDTH - CHART_PADDING * 2)) / (values.length - 1),
        y:
            valueRange === 0
                ? CHART_HEIGHT / 2
                : CHART_PADDING +
                  ((maximum - value) * (CHART_HEIGHT - CHART_PADDING * 2)) / valueRange,
    }));
}

function DashboardMetric({ label, value, testId, icon: MetricIcon }: DashboardMetricProps) {
    return (
        <div className="min-w-0 pt-4">
            <div className="text-muted flex items-center gap-2">
                <MetricIcon size={16} stroke={1.75} aria-hidden="true" />

                <dt className="text-xs tracking-[0.14em] uppercase">{label}</dt>
            </div>

            <dd data-testid={testId} className="text-foreground mt-2 text-xl font-semibold">
                {value}
            </dd>
        </div>
    );
}

function TrendChart({ label, values, icon: TrendIcon }: TrendChartProps) {
    const captionId = useId();

    if (values.length === 0) {
        return null;
    }

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const coordinates = getChartCoordinates(values);

    return (
        <figure aria-labelledby={captionId} className="border-border bg-surface border p-4 sm:p-5">
            <figcaption
                id={captionId}
                className="text-foreground-secondary flex items-center gap-2 text-sm font-medium"
            >
                <TrendIcon size={16} stroke={1.75} className="text-muted" aria-hidden="true" />

                {label}
            </figcaption>

            <svg
                aria-hidden="true"
                focusable="false"
                viewBox={`0 0 ${String(CHART_WIDTH)} ${String(CHART_HEIGHT)}`}
                preserveAspectRatio="none"
                className="text-accent mt-5 h-36 w-full overflow-visible"
            >
                <polyline
                    points={buildPolylinePoints(values)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                />

                {coordinates.map((coordinate, index) => (
                    <circle
                        key={`${label}-${String(index)}`}
                        cx={coordinate.x}
                        cy={coordinate.y}
                        r="1.25"
                        fill="currentColor"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
            </svg>

            <div className="text-subtle mt-4 flex justify-between text-xs">
                <span>min {formatNumber(minimum)}</span>
                <span>max {formatNumber(maximum)}</span>
            </div>
        </figure>
    );
}

export function HistoricalDashboard() {
    const { accessToken } = useAuth();

    const [range, setRange] = useState<AnalyticsRange>('30d');
    const [reloadKey, setReloadKey] = useState(0);

    const requestKey = `${range}:${String(reloadKey)}`;

    const [requestState, setRequestState] = useState<DashboardRequestState>({
        requestKey,
        status: 'loading',
        overview: null,
    });

    const isCurrentRequest = requestState.requestKey === requestKey;

    const status: DashboardLoadStatus = isCurrentRequest ? requestState.status : 'loading';

    const overview = isCurrentRequest ? requestState.overview : null;

    useEffect(() => {
        if (accessToken === null) {
            return;
        }

        let cancelled = false;
        const activeRequestKey = `${range}:${String(reloadKey)}`;

        void getHistoricalAnalyticsOverview(accessToken, range)
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setRequestState({
                    requestKey: activeRequestKey,
                    status: 'ready',
                    overview: response,
                });
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setRequestState({
                    requestKey: activeRequestKey,
                    status: 'error',
                    overview: null,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [accessToken, range, reloadKey]);

    if (accessToken === null) {
        return null;
    }

    return (
        <section className="flex w-full flex-1">
            <div className="mx-auto w-full max-w-6xl px-6 py-12 lg:px-10 lg:py-16">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-accent text-xs tracking-[0.16em] uppercase">dashboard</p>

                        <h1 className="text-foreground mt-3 text-3xl font-semibold">
                            Historical performance
                        </h1>

                        <p className="text-muted mt-3 max-w-2xl text-sm leading-6">
                            Follow your completed typing sessions through recent performance and
                            historical WPM and Accuracy trends.
                        </p>
                    </div>

                    <fieldset>
                        <legend className="sr-only">Historical range</legend>

                        <div
                            data-testid="dashboard-range-controls"
                            className="border-border flex w-fit flex-wrap border p-1"
                        >
                            {RANGE_OPTIONS.map((option) => {
                                const isSelected = option.value === range;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => {
                                            setRange(option.value);
                                        }}
                                        className={`focus-visible:ring-accent cursor-pointer border px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                                            isSelected
                                                ? 'border-accent/70 bg-accent/10 text-accent'
                                                : 'text-muted hover:text-foreground border-transparent'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                </div>

                <div className="mt-10">
                    {status === 'loading' ? (
                        <div
                            role="status"
                            aria-live="polite"
                            data-testid="dashboard-loading"
                            className="py-6"
                        >
                            <h2 className="text-foreground text-xl font-semibold">
                                Loading analytics
                            </h2>

                            <p className="text-muted mt-3 text-sm">
                                Retrieving your historical performance.
                            </p>
                        </div>
                    ) : null}

                    {status === 'error' ? (
                        <div role="alert" data-testid="dashboard-error" className="py-6">
                            <h2 className="text-foreground text-xl font-semibold">
                                Analytics unavailable
                            </h2>

                            <p className="text-muted mt-3 max-w-xl text-sm leading-6">
                                Your historical performance could not be loaded. Try again.
                            </p>

                            <button
                                type="button"
                                onClick={() => {
                                    setReloadKey((current) => current + 1);
                                }}
                                className="border-border text-foreground-secondary hover:border-accent/60 hover:text-accent focus-visible:ring-accent mt-8 cursor-pointer border px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                Try again
                            </button>
                        </div>
                    ) : null}

                    {status === 'ready' &&
                    overview !== null &&
                    overview.summary.sessionCount === 0 ? (
                        <div role="status" data-testid="dashboard-empty" className="py-6">
                            <h2 className="text-foreground text-xl font-semibold">
                                No completed sessions in this range
                            </h2>

                            <p className="text-muted mt-3 max-w-xl text-sm leading-6">
                                Complete a typing test or select a wider historical range.
                            </p>
                        </div>
                    ) : null}

                    {status === 'ready' &&
                    overview !== null &&
                    overview.summary.sessionCount > 0 ? (
                        <div data-testid="dashboard-data">
                            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                                <DashboardMetric
                                    label="Sessions"
                                    value={formatNumber(overview.summary.sessionCount)}
                                    testId="dashboard-session-count"
                                    icon={IconHistory}
                                />

                                <DashboardMetric
                                    label="Recent WPM"
                                    value={formatNumber(overview.summary.recentWpm)}
                                    testId="dashboard-recent-wpm"
                                    icon={IconGauge}
                                />

                                <DashboardMetric
                                    label="Recent Accuracy"
                                    value={formatPercentage(overview.summary.recentAccuracy)}
                                    testId="dashboard-recent-accuracy"
                                    icon={IconTarget}
                                />

                                <DashboardMetric
                                    label="Consistency"
                                    value={formatPercentage(overview.summary.consistency)}
                                    testId="dashboard-consistency"
                                    icon={IconActivity}
                                />
                            </dl>

                            <div className="mt-10">
                                <div>
                                    <p className="text-accent text-xs tracking-[0.16em] uppercase">
                                        trends
                                    </p>

                                    <h2 className="text-foreground mt-3 text-2xl font-semibold">
                                        Performance over time
                                    </h2>

                                    <p className="text-muted mt-3 text-sm leading-6">
                                        Each point represents one completed typing session inside
                                        the selected range.
                                    </p>
                                </div>

                                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <TrendChart
                                        label="WPM trend"
                                        values={overview.trends.map((point) => point.wpm)}
                                        icon={IconGauge}
                                    />

                                    <TrendChart
                                        label="Accuracy trend"
                                        values={overview.trends.map((point) => point.accuracy)}
                                        icon={IconTarget}
                                    />
                                </div>
                            </div>

                            <div className="mt-10">
                                <h2 className="text-foreground text-xl font-semibold">
                                    Historical values
                                </h2>

                                <p className="text-muted mt-2 text-sm leading-6">
                                    Numerical representation of the same trend data shown above.
                                </p>

                                <div className="border-border mt-5 overflow-x-auto border">
                                    <table
                                        data-testid="dashboard-history-table"
                                        className="w-full min-w-lg border-collapse text-left text-sm"
                                    >
                                        <caption className="sr-only">
                                            Historical WPM and Accuracy values
                                        </caption>

                                        <thead>
                                            <tr className="border-border bg-surface border-b">
                                                <th
                                                    scope="col"
                                                    className="text-muted px-4 py-3 text-xs font-medium tracking-[0.1em] uppercase"
                                                >
                                                    Completed
                                                </th>

                                                <th
                                                    scope="col"
                                                    className="text-muted px-4 py-3 text-xs font-medium tracking-[0.1em] uppercase"
                                                >
                                                    WPM
                                                </th>

                                                <th
                                                    scope="col"
                                                    className="text-muted px-4 py-3 text-xs font-medium tracking-[0.1em] uppercase"
                                                >
                                                    Accuracy
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {overview.trends.map((point, index) => (
                                                <tr
                                                    key={`${point.completedAt}-${String(index)}`}
                                                    data-testid="dashboard-history-row"
                                                    className="border-border border-b last:border-b-0"
                                                >
                                                    <td className="text-foreground-secondary px-4 py-3">
                                                        <time dateTime={point.completedAt}>
                                                            {formatTimestamp(point.completedAt)}
                                                        </time>
                                                    </td>

                                                    <td className="text-foreground px-4 py-3 font-medium">
                                                        {formatNumber(point.wpm)}
                                                    </td>

                                                    <td className="text-foreground px-4 py-3 font-medium">
                                                        {formatPercentage(point.accuracy)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
