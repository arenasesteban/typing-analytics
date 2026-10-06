'use client';

import {
    IconActivity,
    IconCalendarTime,
    IconGauge,
    IconTarget,
    type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/use-auth';
import {
    getTypingSessionHistory,
    type TypingSessionHistoryResponse,
} from '@/lib/typing-sessions-api';

const HISTORY_PAGE_SIZE = 20;

type HistoryLoadStatus = 'loading' | 'ready' | 'error';

interface HistoryRequestState {
    readonly requestKey: string;
    readonly status: HistoryLoadStatus;
    readonly history: TypingSessionHistoryResponse | null;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function formatNumber(value: number): string {
    return NUMBER_FORMATTER.format(value);
}

function formatTimestamp(value: string): string {
    return DATE_TIME_FORMATTER.format(new Date(value));
}

interface HistoryMetricProps {
    readonly label: string;
    readonly value: string;
    readonly icon: Icon;
}

function HistoryMetric({ label, value, icon: MetricIcon }: HistoryMetricProps) {
    return (
        <div className="min-w-0">
            <div className="text-muted flex items-center justify-end gap-1.5">
                <MetricIcon size={14} stroke={1.75} aria-hidden="true" />

                <dt className="text-[0.65rem] tracking-[0.12em] uppercase">{label}</dt>
            </div>

            <dd className="text-foreground mt-1.5 text-sm font-semibold">{value}</dd>
        </div>
    );
}

export function HistoryList() {
    const { accessToken } = useAuth();

    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);

    const requestKey = `${String(page)}:${String(reloadKey)}`;

    const [requestState, setRequestState] = useState<HistoryRequestState>({
        requestKey,
        status: 'loading',
        history: null,
    });

    const isCurrentRequest = requestState.requestKey === requestKey;

    const status: HistoryLoadStatus = isCurrentRequest ? requestState.status : 'loading';

    const history = isCurrentRequest ? requestState.history : null;

    useEffect(() => {
        if (accessToken === null) {
            return;
        }

        let cancelled = false;

        const activeRequestKey = `${String(page)}:${String(reloadKey)}`;

        void getTypingSessionHistory(accessToken, page, HISTORY_PAGE_SIZE)
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setRequestState({
                    requestKey: activeRequestKey,
                    status: 'ready',
                    history: response,
                });
            })
            .catch(() => {
                if (cancelled) {
                    return;
                }

                setRequestState({
                    requestKey: activeRequestKey,
                    status: 'error',
                    history: null,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [accessToken, page, reloadKey]);

    if (accessToken === null) {
        return null;
    }

    if (status === 'loading') {
        return (
            <section className="flex w-full flex-1">
                <div
                    role="status"
                    aria-live="polite"
                    data-testid="history-loading"
                    className="mx-auto w-full max-w-5xl px-6 py-16 lg:px-10"
                >
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">history</p>

                    <h1 className="text-foreground mt-3 text-3xl font-semibold">Loading history</h1>

                    <p className="text-muted mt-3 text-sm">
                        Retrieving your completed typing sessions.
                    </p>
                </div>
            </section>
        );
    }

    if (status === 'error') {
        return (
            <section className="flex w-full flex-1">
                <div
                    role="alert"
                    data-testid="history-error"
                    className="mx-auto w-full max-w-5xl px-6 py-16 lg:px-10"
                >
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">history</p>

                    <h1 className="text-foreground mt-3 text-3xl font-semibold">
                        History unavailable
                    </h1>

                    <p className="text-muted mt-3 max-w-xl text-sm leading-6">
                        Your completed sessions could not be loaded. Try again.
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
            </section>
        );
    }

    if (history === null || history.pagination.totalItems === 0) {
        return (
            <section className="flex w-full flex-1">
                <div
                    data-testid="history-empty"
                    className="mx-auto w-full max-w-5xl px-6 py-16 lg:px-10"
                >
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">history</p>

                    <h1 className="text-foreground mt-3 text-3xl font-semibold">
                        No completed sessions yet
                    </h1>

                    <p className="text-muted mt-3 max-w-xl text-sm leading-6">
                        Complete an authenticated typing test and it will appear here.
                    </p>

                    <Link
                        href="/"
                        className="border-accent/70 text-accent hover:border-accent hover:bg-accent/10 focus-visible:ring-accent mt-8 inline-block border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        Start a typing test
                    </Link>
                </div>
            </section>
        );
    }

    const currentPage = history.pagination.page;

    const hasPreviousPage = currentPage > 1;

    const hasNextPage = currentPage < history.pagination.totalPages;

    return (
        <section className="flex w-full flex-1">
            <div className="mx-auto w-full max-w-5xl px-6 py-12 lg:px-10 lg:py-16">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-accent text-xs tracking-[0.16em] uppercase">history</p>

                        <h1 className="text-foreground mt-3 text-3xl font-semibold">
                            Completed sessions
                        </h1>

                        <p className="text-muted mt-3 text-sm">
                            {history.pagination.totalItems} saved{' '}
                            {history.pagination.totalItems === 1 ? 'session' : 'sessions'}
                        </p>
                    </div>

                    <p className="text-subtle text-xs">
                        page {currentPage} of {history.pagination.totalPages}
                    </p>
                </div>

                {history.items.length === 0 ? (
                    <div
                        data-testid="history-page-empty"
                        className="border-border mt-8 border py-10 text-center"
                    >
                        <p className="text-muted text-sm">
                            No sessions are available on this page.
                        </p>
                    </div>
                ) : (
                    <ol data-testid="history-list" className="mt-8 space-y-3">
                        {history.items.map((session) => (
                            <li key={session.id} data-testid={`history-item-${session.id}`}>
                                <Link
                                    href={`/history/${encodeURIComponent(session.id)}`}
                                    aria-label={`Open session ${session.id}`}
                                    className="border-border bg-surface hover:border-accent/40 focus-visible:ring-accent block border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:p-5"
                                >
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <div className="text-foreground-secondary flex items-center gap-2 text-sm">
                                                <IconCalendarTime
                                                    size={16}
                                                    stroke={1.75}
                                                    className="text-muted"
                                                    aria-hidden="true"
                                                />

                                                <time dateTime={session.completedAt}>
                                                    {formatTimestamp(session.completedAt)}
                                                </time>
                                            </div>

                                            <p className="text-subtle mt-2 pl-6 text-xs">
                                                {session.id}
                                            </p>
                                        </div>

                                        <dl className="grid grid-cols-3 gap-5 text-right">
                                            <HistoryMetric
                                                label="wpm"
                                                value={formatNumber(session.wpm)}
                                                icon={IconGauge}
                                            />

                                            <HistoryMetric
                                                label="accuracy"
                                                value={`${formatNumber(session.accuracy)}%`}
                                                icon={IconTarget}
                                            />

                                            <HistoryMetric
                                                label="consistency"
                                                value={`${formatNumber(session.consistency)}%`}
                                                icon={IconActivity}
                                            />
                                        </dl>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ol>
                )}

                <nav
                    data-testid="history-pagination"
                    aria-label="History pagination"
                    className="border-border mt-8 flex items-center justify-between border-t pt-6"
                >
                    <button
                        type="button"
                        disabled={!hasPreviousPage}
                        onClick={() => {
                            if (hasPreviousPage) {
                                setPage(currentPage - 1);
                            }
                        }}
                        className="border-border text-foreground-secondary hover:border-accent/60 hover:text-accent focus-visible:ring-accent cursor-pointer border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Previous page
                    </button>

                    <span aria-live="polite" className="text-muted text-xs">
                        {currentPage} / {history.pagination.totalPages}
                    </span>

                    <button
                        type="button"
                        disabled={!hasNextPage}
                        onClick={() => {
                            if (hasNextPage) {
                                setPage(currentPage + 1);
                            }
                        }}
                        className="border-border text-foreground-secondary hover:border-accent/60 hover:text-accent focus-visible:ring-accent cursor-pointer border px-4 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Next page
                    </button>
                </nav>
            </div>
        </section>
    );
}
