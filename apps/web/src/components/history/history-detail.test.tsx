import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryDetail } from './history-detail';

const { authState } = vi.hoisted(() => ({
    authState: {
        accessToken: 'detail-access-token',
    },
}));

vi.mock('@/auth/use-auth', () => ({
    useAuth: () => authState,
}));

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

const DETAIL = {
    id: SESSION_ID,
    typingText: {
        id: '22222222-2222-4222-8222-222222222222',
        text: 'cat dog moon river',
    },
    durationMs: 60_000,
    wpm: 72,
    rawWpm: 78,
    accuracy: 98.5,
    consistency: 91.25,
    totalInputs: 120,
    correctInputs: 118,
    incorrectInputs: 2,
    startedAt: '2026-10-05T17:59:00.000Z',
    completedAt: '2026-10-05T18:00:00.000Z',
    behavioral: {
        status: 'unavailable',
    },
};

const READY_DETAIL = {
    ...DETAIL,
    behavioral: {
        status: 'ready',
        temporal: {
            sampleIntervalMs: 1000,
            points: Array.from({ length: 60 }, (_, index) => ({
                elapsedMs: (index + 1) * 1000,
                wpm: 72,
                rawWpm: 78,
            })),
        },
    },
};

beforeEach(() => {
    authState.accessToken = 'detail-access-token';

    fetchMock.mockReset();

    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('HistoryDetail', () => {
    it('represents detail loading', () => {
        fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

        render(<HistoryDetail sessionId={SESSION_ID} />);

        expect(screen.getByTestId('history-detail-loading')).toHaveTextContent('Loading session');
    });

    it('renders the concrete target and persisted metrics', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(DETAIL));

        render(<HistoryDetail sessionId={SESSION_ID} />);

        expect(await screen.findByTestId('history-detail')).toBeInTheDocument();

        expect(screen.getByTestId('history-detail-target')).toHaveTextContent(
            DETAIL.typingText.text,
        );

        expect(screen.getByTestId('history-detail')).toHaveTextContent('72');

        expect(screen.getByTestId('history-detail')).toHaveTextContent('78');

        expect(screen.getByTestId('history-detail')).toHaveTextContent('98.5%');

        expect(screen.getByTestId('history-detail')).toHaveTextContent('91.25%');

        expect(screen.getByTestId('history-detail')).toHaveTextContent('120');

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `http://localhost:3001/typing-sessions/${SESSION_ID}`,
        );

        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer detail-access-token',
            },
        });
    });

    it('renders READY behavioral results for the requested session', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(READY_DETAIL));

        render(<HistoryDetail sessionId={SESSION_ID} />);

        const chart = await screen.findByTestId('temporal-performance-chart');

        expect(chart).toBeInTheDocument();

        expect(screen.getByTestId('chart-wpm-curve')).toBeInTheDocument();

        expect(screen.getByTestId('chart-raw-wpm-curve')).toBeInTheDocument();

        expect(chart.querySelectorAll('polyline')).toHaveLength(2);

        expect(screen.getByTestId('chart-sample-count')).toHaveTextContent('60 temporal samples');

        expect(screen.queryByTestId('history-behavioral-pending')).not.toBeInTheDocument();

        expect(screen.queryByTestId('history-behavioral-unavailable')).not.toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledTimes(1);

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            `http://localhost:3001/typing-sessions/${SESSION_ID}`,
        );
    });

    it('renders PENDING without inventing behavioral results', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                ...DETAIL,
                behavioral: {
                    status: 'pending',
                },
            }),
        );

        render(<HistoryDetail sessionId={SESSION_ID} />);

        expect(await screen.findByTestId('history-behavioral-pending')).toBeInTheDocument();

        expect(screen.getByTestId('history-behavioral-pending')).toHaveTextContent(
            'Behavioral results pending',
        );

        expect(
            screen.getByRole('button', {
                name: 'Check again',
            }),
        ).toBeInTheDocument();

        expect(screen.queryByTestId('temporal-performance-chart')).not.toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('preserves metrics for UNAVAILABLE historical sessions', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(DETAIL));

        render(<HistoryDetail sessionId={SESSION_ID} />);

        expect(await screen.findByTestId('history-behavioral-unavailable')).toBeInTheDocument();

        expect(screen.getByTestId('history-behavioral-unavailable')).toHaveTextContent(
            'Behavioral results unavailable',
        );

        expect(screen.getByTestId('history-detail')).toHaveTextContent('72');

        expect(screen.getByTestId('history-detail')).toHaveTextContent('78');

        expect(screen.getByTestId('history-detail')).toHaveTextContent('98.5%');

        expect(screen.getByTestId('history-detail-target')).toHaveTextContent(
            DETAIL.typingText.text,
        );

        expect(screen.queryByTestId('temporal-performance-chart')).not.toBeInTheDocument();

        expect(
            screen.queryByRole('button', {
                name: 'Check again',
            }),
        ).not.toBeInTheDocument();
    });

    it('rechecks a pending session without introducing another endpoint', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    ...DETAIL,
                    behavioral: {
                        status: 'pending',
                    },
                }),
            )
            .mockResolvedValueOnce(jsonResponse(READY_DETAIL));

        const user = userEvent.setup();

        render(<HistoryDetail sessionId={SESSION_ID} />);

        expect(await screen.findByTestId('history-behavioral-pending')).toBeInTheDocument();

        await user.click(
            screen.getByRole('button', {
                name: 'Check again',
            }),
        );

        expect(await screen.findByTestId('temporal-performance-chart')).toBeInTheDocument();

        expect(screen.queryByTestId('history-behavioral-pending')).not.toBeInTheDocument();

        expect(screen.getByTestId('chart-wpm-curve')).toBeInTheDocument();

        expect(screen.getByTestId('chart-raw-wpm-curve')).toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledTimes(2);

        const expectedUrl = `http://localhost:3001/typing-sessions/${SESSION_ID}`;

        expect(fetchMock.mock.calls[0]?.[0]).toBe(expectedUrl);

        expect(fetchMock.mock.calls[1]?.[0]).toBe(expectedUrl);

        expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer detail-access-token',
            },
        });
    });

    it('represents missing or inaccessible detail without exposing ownership information', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    message: 'Typing session not found',
                },
                404,
            ),
        );

        render(<HistoryDetail sessionId={SESSION_ID} />);

        expect(await screen.findByTestId('history-detail-unavailable')).toHaveTextContent(
            'Session unavailable',
        );

        expect(screen.getByTestId('history-detail-unavailable')).not.toHaveTextContent(
            'belongs to another user',
        );

        expect(screen.queryByTestId('temporal-performance-chart')).not.toBeInTheDocument();
    });

    it('represents a non-404 detail API failure', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    message: 'Service unavailable',
                },
                503,
            ),
        );

        render(<HistoryDetail sessionId={SESSION_ID} />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Session could not be loaded');

        expect(
            screen.getByRole('button', {
                name: 'Try again',
            }),
        ).toBeInTheDocument();

        expect(screen.queryByTestId('temporal-performance-chart')).not.toBeInTheDocument();
    });
});
