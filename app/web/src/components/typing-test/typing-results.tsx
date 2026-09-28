import type { CompletedSessionSummary } from '@typing-analytics/typing-core';

interface TypingResultsProps {
    readonly summary: CompletedSessionSummary;
    readonly onRestart: () => void;
}

interface ResultMetricProps {
    readonly label: string;
    readonly value: string;
    readonly testId: string;
    readonly primary?: boolean;
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

function ResultMetric({ label, value, testId, primary = false }: ResultMetricProps) {
    return (
        <div
            className={
                primary
                    ? 'border-accent-strong/30 bg-accent-strong/5 rounded-lg border p-5'
                    : 'border-border-strong bg-surface-raised/40 rounded-lg border p-5'
            }
        >
            <dt className="text-muted text-xs tracking-widest uppercase">{label}</dt>

            <dd
                data-testid={testId}
                className={
                    primary
                        ? 'text-accent mt-2 text-4xl font-semibold'
                        : 'text-foreground mt-2 text-2xl font-semibold'
                }
            >
                {value}
            </dd>
        </div>
    );
}

export function TypingResults({ summary, onRestart }: TypingResultsProps) {
    return (
        <section
            data-testid="typing-results"
            aria-labelledby="typing-results-title"
            className="border-border-strong bg-surface/40 rounded-xl border p-6 sm:p-8"
        >
            <header className="mb-8">
                <p className="text-accent-strong text-xs tracking-widest uppercase">
                    session complete
                </p>

                <h2
                    id="typing-results-title"
                    className="text-foreground mt-2 text-2xl font-semibold"
                >
                    Results
                </h2>
            </header>

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ResultMetric
                    label="WPM"
                    value={formatSpeed(summary.wpm)}
                    testId="result-wpm"
                    primary
                />

                <ResultMetric
                    label="Accuracy"
                    value={formatPercentage(summary.accuracy)}
                    testId="result-accuracy"
                />

                <ResultMetric
                    label="Consistency"
                    value={formatPercentage(summary.consistency)}
                    testId="result-consistency"
                />

                <ResultMetric
                    label="Raw WPM"
                    value={formatSpeed(summary.rawWpm)}
                    testId="result-raw-wpm"
                />

                <ResultMetric
                    label="Duration"
                    value={formatDuration(summary.durationMs)}
                    testId="result-duration"
                />

                <ResultMetric
                    label="Errors"
                    value={summary.incorrectInputs.toString()}
                    testId="result-errors"
                />
            </dl>

            <button
                type="button"
                onClick={onRestart}
                className="bg-accent-strong text-background hover:bg-accent focus-visible:ring-accent focus-visible:ring-offset-background mt-8 rounded-lg px-5 py-3 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                Restart test
            </button>
        </section>
    );
}
