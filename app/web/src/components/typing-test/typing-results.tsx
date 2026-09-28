import {
    IconActivity,
    IconAlertTriangle,
    IconBolt,
    IconCircleCheck,
    IconClock,
    IconGauge,
    IconRefresh,
    IconTarget,
    type Icon,
} from '@tabler/icons-react';

import type { CompletedSessionSummary } from '@typing-analytics/typing-core';

interface TypingResultsProps {
    readonly summary: CompletedSessionSummary;
    readonly onRestart: () => void;
}

interface ResultMetricProps {
    readonly label: string;
    readonly value: string;
    readonly testId: string;
    readonly icon: Icon;
}

function formatSpeed(value: number): string {
    return Math.round(value).toString();
}

function formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
}

function formatDuration(durationMs: number): string {
    return `${(durationMs / 1_000).toFixed(1)} s`;
}

function ResultMetric({
    label,
    value,
    testId,
    icon: MetricIcon,
}: ResultMetricProps) {
    return (
        <div className="flex min-w-0 flex-col pt-4">
            <div className="text-muted flex items-center gap-2">
                <MetricIcon
                    size={16}
                    stroke={1.75}
                    aria-hidden="true"
                />

                <dt className="text-xs tracking-[0.14em] uppercase">
                    {label}
                </dt>
            </div>

            <dd
                data-testid={testId}
                className="text-foreground mt-2 text-2xl font-semibold"
            >
                {value}
            </dd>
        </div>
    );
}

export function TypingResults({
    summary,
    onRestart,
}: TypingResultsProps) {
    return (
        <section
            data-testid="typing-results"
            aria-labelledby="typing-results-title"
            className="w-full"
        >
            <header className="mb-10">
                <div className="text-accent-strong flex items-center gap-2">
                    <IconCircleCheck
                        size={17}
                        stroke={1.8}
                        aria-hidden="true"
                    />

                    <p className="text-xs tracking-[0.16em] uppercase">
                        session complete
                    </p>
                </div>

                <h2
                    id="typing-results-title"
                    className="text-foreground mt-3 text-2xl font-semibold"
                >
                    Results
                </h2>
            </header>

            <div className="mb-10 flex items-end gap-4">
                <IconGauge
                    size={26}
                    stroke={1.6}
                    className="text-accent mb-1"
                    aria-hidden="true"
                />

                <div>
                    <p className="text-muted text-xs tracking-[0.14em] uppercase">
                        WPM
                    </p>

                    <p
                        data-testid="result-wpm"
                        className="text-accent mt-1 text-5xl leading-none font-semibold"
                    >
                        {formatSpeed(summary.wpm)}
                    </p>
                </div>
            </div>

            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
                <ResultMetric
                    label="Accuracy"
                    value={formatPercentage(summary.accuracy)}
                    testId="result-accuracy"
                    icon={IconTarget}
                />

                <ResultMetric
                    label="Consistency"
                    value={formatPercentage(summary.consistency)}
                    testId="result-consistency"
                    icon={IconActivity}
                />

                <ResultMetric
                    label="Raw WPM"
                    value={formatSpeed(summary.rawWpm)}
                    testId="result-raw-wpm"
                    icon={IconBolt}
                />

                <ResultMetric
                    label="Duration"
                    value={formatDuration(summary.durationMs)}
                    testId="result-duration"
                    icon={IconClock}
                />

                <ResultMetric
                    label="Errors"
                    value={summary.incorrectInputs.toString()}
                    testId="result-errors"
                    icon={IconAlertTriangle}
                />
            </dl>

            <button
                type="button"
                onClick={onRestart}
                className="border-border text-foreground-secondary hover:border-accent/50 hover:text-accent focus-visible:ring-accent mt-12 flex items-center gap-2 border px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none cursor-pointer"
            >
                <IconRefresh
                    size={17}
                    stroke={1.8}
                    aria-hidden="true"
                />

                Restart test
            </button>
        </section>
    );
}