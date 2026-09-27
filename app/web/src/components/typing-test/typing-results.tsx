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
                    ? 'rounded-lg border border-amber-400/30 bg-amber-400/5 p-5'
                    : 'rounded-lg border border-zinc-800 bg-zinc-950/40 p-5'
            }
        >
            <dt className="font-mono text-xs tracking-widest text-zinc-500 uppercase">{label}</dt>

            <dd
                data-testid={testId}
                className={
                    primary
                        ? 'mt-2 font-mono text-4xl font-semibold text-amber-300'
                        : 'mt-2 font-mono text-2xl font-semibold text-zinc-100'
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
            className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8"
        >
            <header className="mb-8">
                <p className="font-mono text-xs tracking-widest text-amber-400 uppercase">
                    session complete
                </p>

                <h2 id="typing-results-title" className="mt-2 text-2xl font-semibold text-zinc-100">
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
                className="mt-8 rounded-lg bg-amber-400 px-5 py-3 font-mono text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:outline-none"
            >
                Restart test
            </button>
        </section>
    );
}
