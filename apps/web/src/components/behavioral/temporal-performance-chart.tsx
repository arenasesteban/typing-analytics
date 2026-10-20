'use client';

import type { SessionBehavioralResult } from '@typing-analytics/typing-core';

type TemporalResult = SessionBehavioralResult['temporal'];

interface TemporalPerformanceChartProps {
    readonly temporal: TemporalResult;
    readonly variant?: 'standard' | 'compact';
}

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 160;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 152;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const TICK_COUNT = 4;
const TICK_INDICES = [4, 3, 2, 1, 0] as const;

function formatElapsed(elapsedMs: number): string {
    return `${(elapsedMs / 1000).toFixed(2)} s`;
}

function getTickStep(maxSpeed: number): number {
    const roughStep = Math.max(maxSpeed, 10) / TICK_COUNT;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalizedStep = roughStep / magnitude;

    const multiplier =
        normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10;

    return multiplier * magnitude;
}

function ChartLegend({ compact }: { readonly compact: boolean }) {
    return (
        <div
            className={
                compact
                    ? 'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'
                    : 'flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'
            }
        >
            <span className="text-accent flex items-center gap-2">
                <span aria-hidden="true" className="bg-accent inline-block h-0.5 w-5" />
                WPM
            </span>

            <span className="text-foreground-secondary flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="bg-foreground-secondary inline-block h-0.5 w-5"
                />
                Raw WPM
            </span>
        </div>
    );
}

export function TemporalPerformanceChart({
    temporal,
    variant = 'standard',
}: TemporalPerformanceChartProps) {
    const compact = variant === 'compact';
    const { points } = temporal;

    const durationMs = points.at(-1)?.elapsedMs ?? 0;
    const maxSpeed = points.reduce(
        (maximum, point) => Math.max(maximum, point.wpm, point.rawWpm),
        0,
    );
    const tickStep = getTickStep(maxSpeed);
    const axisMax = tickStep * TICK_COUNT;

    const x = (elapsedMs: number): number =>
        durationMs === 0 ? 0 : (elapsedMs / durationMs) * VIEW_WIDTH;

    const y = (speed: number): number => PLOT_BOTTOM - (speed / axisMax) * PLOT_HEIGHT;

    const wpmCoordinates = points
        .map((point) => `${String(x(point.elapsedMs))},${String(y(point.wpm))}`)
        .join(' ');

    const rawWpmCoordinates = points
        .map((point) => `${String(x(point.elapsedMs))},${String(y(point.rawWpm))}`)
        .join(' ');

    const chartHeightClass = compact ? 'h-32 sm:h-36' : 'h-40 sm:h-48';

    return (
        <section
            aria-labelledby="temporal-performance-title"
            data-testid="temporal-performance-chart"
            className={compact ? 'min-w-0' : 'border-border mt-10 min-w-0 border p-4 sm:p-6'}
        >
            <header
                className={
                    compact ? 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2' : ''
                }
            >
                <h2
                    id="temporal-performance-title"
                    className={
                        compact
                            ? 'text-foreground text-sm font-semibold'
                            : 'text-foreground text-lg font-semibold'
                    }
                >
                    Temporal performance
                </h2>

                {compact ? <ChartLegend compact /> : null}

                {!compact ? (
                    <p className="text-muted mt-2 text-sm">
                        Cumulative typing speed, sampled every second.
                    </p>
                ) : null}
            </header>

            {!compact ? (
                <div className="mt-4">
                    <ChartLegend compact={false} />
                </div>
            ) : null}

            <span data-testid="chart-sample-count" className="sr-only">
                {points.length} temporal samples
            </span>

            <div className="mt-4 grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2">
                <span className="text-subtle text-[10px] tracking-wide uppercase">WPM</span>
                <span aria-hidden="true" />

                <div className={`relative ${chartHeightClass}`} aria-hidden="true">
                    {TICK_INDICES.map((index) => (
                        <span
                            key={index}
                            className="text-muted absolute right-0 -translate-y-1/2 text-[10px] tabular-nums sm:text-xs"
                            style={{
                                top: `${String(
                                    ((PLOT_BOTTOM - (index / TICK_COUNT) * PLOT_HEIGHT) /
                                        VIEW_HEIGHT) *
                                        100,
                                )}%`,
                            }}
                        >
                            {tickStep * index}
                        </span>
                    ))}
                </div>

                <svg
                    viewBox={`0 0 ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    focusable="false"
                    className={`block w-full ${chartHeightClass}`}
                >
                    {TICK_INDICES.map((index) => {
                        const tickY = y(tickStep * index);

                        return (
                            <line
                                key={index}
                                x1={0}
                                y1={tickY}
                                x2={VIEW_WIDTH}
                                y2={tickY}
                                stroke="currentColor"
                                strokeWidth={1}
                                strokeDasharray={index === 0 ? undefined : '3 6'}
                                vectorEffect="non-scaling-stroke"
                                className="text-border"
                            />
                        );
                    })}

                    <line
                        x1={0}
                        y1={PLOT_TOP}
                        x2={0}
                        y2={PLOT_BOTTOM}
                        stroke="currentColor"
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                        className="text-border"
                    />

                    <polyline
                        data-testid="chart-wpm-curve"
                        points={wpmCoordinates}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        className="text-accent"
                    />

                    <polyline
                        data-testid="chart-raw-wpm-curve"
                        points={rawWpmCoordinates}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        className="text-foreground-secondary"
                    />
                </svg>

                <span aria-hidden="true" />
                <div className="text-muted mt-1 flex justify-between text-[10px] tabular-nums sm:text-xs">
                    <span>0 s</span>
                    {durationMs > 0 ? (
                        <>
                            <span>{formatElapsed(durationMs / 2)}</span>
                            <span>{formatElapsed(durationMs)}</span>
                        </>
                    ) : null}
                </div>
            </div>

            <details className="border-border mt-5 border-t pt-4">
                <summary className="text-foreground-secondary focus-visible:ring-accent w-fit cursor-pointer text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none">
                    View temporal speed values
                </summary>

                <div
                    role="region"
                    aria-label="Temporal speed values table"
                    tabIndex={0}
                    className="focus-visible:ring-accent mt-4 max-w-full overflow-x-auto focus-visible:ring-2 focus-visible:outline-none"
                >
                    <table className="w-full min-w-76 border-collapse text-left text-sm">
                        <caption className="sr-only">Temporal WPM and Raw WPM measurements</caption>
                        <thead>
                            <tr className="border-border border-b">
                                <th scope="col" className="px-3 py-2 font-semibold">
                                    Elapsed time
                                </th>
                                <th scope="col" className="px-3 py-2 font-semibold">
                                    WPM
                                </th>
                                <th scope="col" className="px-3 py-2 font-semibold">
                                    Raw WPM
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {points.map((point) => (
                                <tr
                                    key={point.elapsedMs}
                                    className="border-border border-b last:border-b-0"
                                >
                                    <td className="px-3 py-2">{formatElapsed(point.elapsedMs)}</td>
                                    <td className="px-3 py-2">{point.wpm}</td>
                                    <td className="px-3 py-2">{point.rawWpm}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </section>
    );
}
