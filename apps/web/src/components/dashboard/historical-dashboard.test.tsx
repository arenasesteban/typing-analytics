import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoricalDashboard } from './historical-dashboard';

const { authState } = vi.hoisted(() => ({
    authState: {
        accessToken: 'dashboard-access-token',
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

const OVERVIEW_30D = {
    range: '30d',
    summary: {
        sessionCount: 2,
        recentWpm: 72,
        recentAccuracy: 98.5,
        consistency: 91.25,
    },
    trends: [
        {
            completedAt: '2026-10-04T18:00:00.000Z',
            wpm: 68,
            accuracy: 96.5,
        },
        {
            completedAt: '2026-10-05T18:00:00.000Z',
            wpm: 72,
            accuracy: 98.5,
        },
    ],
};

const OVERVIEW_7D = {
    range: '7d',
    summary: {
        sessionCount: 1,
        recentWpm: 72,
        recentAccuracy: 98.5,
        consistency: 92,
    },
    trends: [
        {
            completedAt: '2026-10-05T18:00:00.000Z',
            wpm: 72,
            accuracy: 98.5,
        },
    ],
};

const OVERVIEW_ALL = {
    range: 'all',
    summary: {
        sessionCount: 3,
        recentWpm: 72,
        recentAccuracy: 98.5,
        consistency: 89.5,
    },
    trends: [
        {
            completedAt: '2026-09-15T18:00:00.000Z',
            wpm: 61,
            accuracy: 94,
        },
        ...OVERVIEW_30D.trends,
    ],
};

beforeEach(() => {
    authState.accessToken = 'dashboard-access-token';

    fetchMock.mockReset();

    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('HistoricalDashboard', () => {
    it('renders the loading state while the overview request is pending', () => {
        fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

        render(<HistoricalDashboard />);

        expect(screen.getByTestId('dashboard-loading')).toHaveTextContent('Loading analytics');

        expect(
            screen.getByRole('button', {
                name: 'Last 30 days',
            }),
        ).toHaveAttribute('aria-pressed', 'true');
    });

    it('requests the default 30d range and renders an explicit empty state', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                range: '30d',
                summary: {
                    sessionCount: 0,
                    recentWpm: null,
                    recentAccuracy: null,
                    consistency: null,
                },
                trends: [],
            }),
        );

        render(<HistoricalDashboard />);

        expect(await screen.findByTestId('dashboard-empty')).toHaveTextContent(
            'No completed sessions in this range',
        );

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            'http://localhost:3001/analytics/overview?range=30d',
        );

        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer dashboard-access-token',
            },
        });
    });

    it('renders summary metrics and the historical values returned by the API', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(OVERVIEW_30D));

        render(<HistoricalDashboard />);

        expect(await screen.findByTestId('dashboard-data')).toBeInTheDocument();

        expect(screen.getByTestId('dashboard-session-count')).toHaveTextContent('2');
        expect(screen.getByTestId('dashboard-recent-wpm')).toHaveTextContent('72');
        expect(screen.getByTestId('dashboard-recent-accuracy')).toHaveTextContent('98.5%');
        expect(screen.getByTestId('dashboard-consistency')).toHaveTextContent('91.25%');

        expect(screen.getByRole('figure', { name: 'WPM trend' })).toBeInTheDocument();
        expect(screen.getByRole('figure', { name: 'Accuracy trend' })).toBeInTheDocument();

        expect(screen.getAllByTestId('dashboard-history-row')).toHaveLength(2);

        expect(screen.getByTestId('dashboard-history-table')).toHaveTextContent('68');
        expect(screen.getByTestId('dashboard-history-table')).toHaveTextContent('96.5%');
        expect(screen.getByTestId('dashboard-history-table')).toHaveTextContent('72');
        expect(screen.getByTestId('dashboard-history-table')).toHaveTextContent('98.5%');
    });

    it('renders a recoverable error state and retries the request', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(
                    {
                        message: 'Service unavailable',
                    },
                    503,
                ),
            )
            .mockResolvedValueOnce(jsonResponse(OVERVIEW_30D));

        const user = userEvent.setup();

        render(<HistoricalDashboard />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Analytics unavailable');

        await user.click(
            screen.getByRole('button', {
                name: 'Try again',
            }),
        );

        expect(await screen.findByTestId('dashboard-data')).toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('requests and renders the selected temporal ranges', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(OVERVIEW_30D))
            .mockResolvedValueOnce(jsonResponse(OVERVIEW_7D))
            .mockResolvedValueOnce(jsonResponse(OVERVIEW_ALL));

        const user = userEvent.setup();

        render(<HistoricalDashboard />);

        await screen.findByTestId('dashboard-data');

        await user.click(
            screen.getByRole('button', {
                name: 'Last 7 days',
            }),
        );

        await waitFor(() => {
            expect(fetchMock.mock.calls[1]?.[0]).toBe(
                'http://localhost:3001/analytics/overview?range=7d',
            );
        });

        expect(await screen.findByTestId('dashboard-session-count')).toHaveTextContent('1');

        expect(
            screen.getByRole('button', {
                name: 'Last 7 days',
            }),
        ).toHaveAttribute('aria-pressed', 'true');

        await user.click(
            screen.getByRole('button', {
                name: 'All time',
            }),
        );

        await waitFor(() => {
            expect(fetchMock.mock.calls[2]?.[0]).toBe(
                'http://localhost:3001/analytics/overview?range=all',
            );
        });

        expect(await screen.findByTestId('dashboard-session-count')).toHaveTextContent('3');

        expect(
            screen.getByRole('button', {
                name: 'All time',
            }),
        ).toHaveAttribute('aria-pressed', 'true');
    });
});
