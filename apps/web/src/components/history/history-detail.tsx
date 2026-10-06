'use client';

import {
    IconActivity,
    IconAlertTriangle,
    IconBolt,
    IconCircleCheck,
    IconClock,
    IconGauge,
    IconKeyboard,
    IconTarget,
    type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/use-auth';
import {
    getTypingSessionHistoryDetail,
    TypingSessionsApiError,
    type TypingSessionHistoryDetail as TypingSessionHistoryDetailData,
} from '@/lib/typing-sessions-api';

interface HistoryDetailProps {
    readonly sessionId: string;
}

type DetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

interface DetailRequestState {
    readonly requestKey: string;
    readonly status: DetailStatus;
    readonly session: TypingSessionHistoryDetailData | null;
}

const NUMBER_FORMATTER = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
});

function formatNumber(value: number): string {
    return NUMBER_FORMATTER.format(value);
}

function formatDuration(durationMs: number): string {
    return `${(durationMs / 1000).toFixed(2)} s`;
}

function formatTimestamp(value: string): string {
    return DATE_TIME_FORMATTER.format(new Date(value));
}

interface MetricProps {
    readonly label: string;
    readonly value: string;
    readonly icon: Icon;
}

function Metric({ label, value, icon: MetricIcon }: MetricProps) {
    return (
        <div className="min-w-0 pt-4">
            <div className="text-muted flex items-center gap-2">
                <MetricIcon size={16} stroke={1.75} aria-hidden="true" />

                <dt className="text-xs tracking-[0.14em] uppercase">{label}</dt>
            </div>

            <dd className="text-foreground mt-2 text-xl font-semibold">{value}</dd>
        </div>
    );
}

export function HistoryDetail({ sessionId }: HistoryDetailProps) {
    const { accessToken } = useAuth();

    const [reloadKey, setReloadKey] = useState(0);

    const requestKey = `${sessionId}:${String(reloadKey)}`;

    const [requestState, setRequestState] = useState<DetailRequestState>({
        requestKey,
        status: 'loading',
        session: null,
    });

    const isCurrentRequest = requestState.requestKey === requestKey;

    const status: DetailStatus = isCurrentRequest ? requestState.status : 'loading';

    const session = isCurrentRequest ? requestState.session : null;

    useEffect(() => {
        if (accessToken === null) {
            return;
        }

        let cancelled = false;

        const activeRequestKey = `${sessionId}:${String(reloadKey)}`;

        void getTypingSessionHistoryDetail(accessToken, sessionId)
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setRequestState({
                    requestKey: activeRequestKey,
                    status: 'ready',
                    session: response,
                });
            })
            .catch((error: unknown) => {
                if (cancelled) {
                    return;
                }

                if (error instanceof TypingSessionsApiError && error.status === 404) {
                    setRequestState({
                        requestKey: activeRequestKey,
                        status: 'not-found',
                        session: null,
                    });

                    return;
                }

                setRequestState({
                    requestKey: activeRequestKey,
                    status: 'error',
                    session: null,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [accessToken, reloadKey, sessionId]);

    if (accessToken === null) {
        return null;
    }

    if (status === 'loading') {
        return (
            <section className="flex w-full flex-1">
                <div
                    role="status"
                    aria-live="polite"
                    data-testid="history-detail-loading"
                    className="mx-auto w-full max-w-5xl px-6 py-16 lg:px-10"
                >
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">history</p>

                    <h1 className="text-foreground mt-3 text-3xl font-semibold">Loading session</h1>
                </div>
            </section>
        );
    }

    if (status === 'not-found') {
        return (
            <section className="flex w-full flex-1">
                <div
                    role="alert"
                    data-testid="history-detail-unavailable"
                    className="mx-auto w-full max-w-5xl px-6 py-16 lg:px-10"
                >
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">history</p>

                    <h1 className="text-foreground mt-3 text-3xl font-semibold">
                        Session unavailable
                    </h1>

                    <p className="text-muted mt-3 max-w-xl text-sm leading-6">
                        This completed session does not exist or is not available to your account.
                    </p>

                    <Link
                        href="/history"
                        className="border-border text-foreground-secondary hover:border-accent/60 hover:text-accent focus-visible:ring-accent mt-8 inline-block border px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                        Back to history
                    </Link>
                </div>
            </section>
        );
    }

    if (status === 'error') {
        return (
            <section className="flex w-full flex-1">
                <div
                    role="alert"
                    data-testid="history-detail-error"
                    className="mx-auto w-full max-w-5xl px-6 py-16 lg:px-10"
                >
                    <p className="text-accent text-xs tracking-[0.16em] uppercase">history</p>

                    <h1 className="text-foreground mt-3 text-3xl font-semibold">
                        Session could not be loaded
                    </h1>

                    <p className="text-muted mt-3 text-sm">Try loading this session again.</p>

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

    if (session === null) {
        return null;
    }

    return (
        <section className="flex w-full flex-1">
            <div
                data-testid="history-detail"
                className="mx-auto w-full max-w-5xl px-6 py-12 lg:px-10 lg:py-16"
            >
                <Link
                    href="/history"
                    className="text-muted hover:text-accent focus-visible:text-accent text-sm transition-colors focus-visible:outline-none"
                >
                    ← Back to history
                </Link>

                <div className="text-accent mt-8 flex items-center gap-2">
                    <IconCircleCheck size={17} stroke={1.8} aria-hidden="true" />

                    <p className="text-xs tracking-[0.16em] uppercase">session detail</p>
                </div>

                <h1 className="text-foreground mt-3 text-3xl font-semibold">
                    Completed typing session
                </h1>

                <p className="text-subtle mt-2 text-xs break-all">{session.id}</p>

                <div className="border-border mt-8 border">
                    <div className="border-border border-b px-4 py-3 sm:px-5">
                        <p className="text-subtle text-[0.65rem] tracking-[0.12em] uppercase">
                            typing target
                        </p>
                    </div>

                    <p
                        data-testid="history-detail-target"
                        className="text-foreground-secondary bg-surface-raised px-4 py-5 text-sm leading-7 wrap-break-word whitespace-pre-wrap sm:px-5"
                    >
                        {session.typingText.text}
                    </p>
                </div>

                <dl className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="wpm" value={formatNumber(session.wpm)} icon={IconGauge} />

                    <Metric label="raw wpm" value={formatNumber(session.rawWpm)} icon={IconBolt} />

                    <Metric
                        label="accuracy"
                        value={`${formatNumber(session.accuracy)}%`}
                        icon={IconTarget}
                    />

                    <Metric
                        label="consistency"
                        value={`${formatNumber(session.consistency)}%`}
                        icon={IconActivity}
                    />

                    <Metric
                        label="duration"
                        value={formatDuration(session.durationMs)}
                        icon={IconClock}
                    />

                    <Metric
                        label="inputs"
                        value={String(session.totalInputs)}
                        icon={IconKeyboard}
                    />

                    <Metric
                        label="correct"
                        value={String(session.correctInputs)}
                        icon={IconCircleCheck}
                    />

                    <Metric
                        label="incorrect"
                        value={String(session.incorrectInputs)}
                        icon={IconAlertTriangle}
                    />
                </dl>

                <dl className="border-border mt-6 grid gap-4 border-t pt-6 text-sm sm:grid-cols-2">
                    <div>
                        <dt className="text-subtle text-xs uppercase">started</dt>
                        <dd className="text-foreground-secondary mt-1">
                            <time dateTime={session.startedAt}>
                                {formatTimestamp(session.startedAt)}
                            </time>
                        </dd>
                    </div>

                    <div>
                        <dt className="text-subtle text-xs uppercase">completed</dt>
                        <dd className="text-foreground-secondary mt-1">
                            <time dateTime={session.completedAt}>
                                {formatTimestamp(session.completedAt)}
                            </time>
                        </dd>
                    </div>
                </dl>
            </div>
        </section>
    );
}
