import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HistoryList } from './history-list';

const { authState } = vi.hoisted(() => ({
    authState: {
        accessToken: 'history-access-token',
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

const SESSION_ONE = {
    id: '11111111-1111-4111-8111-111111111111',
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
};

const SESSION_TWO = {
    ...SESSION_ONE,
    id: '22222222-2222-4222-8222-222222222222',
    wpm: 68,
    completedAt: '2026-10-04T18:00:00.000Z',
};

beforeEach(() => {
    authState.accessToken = 'history-access-token';

    fetchMock.mockReset();

    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('HistoryList', () => {
    it('represents history loading', () => {
        fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

        render(<HistoryList />);

        expect(screen.getByTestId('history-loading')).toHaveTextContent('Loading history');
    });

    it('represents an empty history explicitly', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                items: [],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    totalItems: 0,
                    totalPages: 0,
                },
            }),
        );

        render(<HistoryList />);

        expect(await screen.findByTestId('history-empty')).toHaveTextContent(
            'No completed sessions yet',
        );

        expect(fetchMock.mock.calls[0]?.[0]).toBe(
            'http://localhost:3001/typing-sessions?page=1&pageSize=20',
        );

        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer history-access-token',
            },
        });
    });

    it('renders completed sessions and links each one to its detail', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                items: [SESSION_ONE, SESSION_TWO],
                pagination: {
                    page: 1,
                    pageSize: 20,
                    totalItems: 2,
                    totalPages: 1,
                },
            }),
        );

        render(<HistoryList />);

        expect(await screen.findByTestId('history-list')).toBeInTheDocument();

        expect(screen.getByTestId(`history-item-${SESSION_ONE.id}`)).toHaveTextContent('72');

        expect(screen.getByTestId(`history-item-${SESSION_ONE.id}`)).toHaveTextContent('98.5%');

        expect(
            screen.getByRole('link', {
                name: `Open session ${SESSION_ONE.id}`,
            }),
        ).toHaveAttribute('href', `/history/${SESSION_ONE.id}`);
    });

    it('navigates between server-provided history pages', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    items: [SESSION_ONE],
                    pagination: {
                        page: 1,
                        pageSize: 20,
                        totalItems: 21,
                        totalPages: 2,
                    },
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({
                    items: [SESSION_TWO],
                    pagination: {
                        page: 2,
                        pageSize: 20,
                        totalItems: 21,
                        totalPages: 2,
                    },
                }),
            );

        const user = userEvent.setup();

        render(<HistoryList />);

        await screen.findByTestId(`history-item-${SESSION_ONE.id}`);

        await user.click(
            screen.getByRole('button', {
                name: 'Next page',
            }),
        );

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        expect(fetchMock.mock.calls[1]?.[0]).toBe(
            'http://localhost:3001/typing-sessions?page=2&pageSize=20',
        );

        expect(await screen.findByTestId(`history-item-${SESSION_TWO.id}`)).toBeInTheDocument();

        expect(screen.getByTestId('history-pagination')).toHaveTextContent('2 / 2');

        expect(
            screen.getByRole('button', {
                name: 'Next page',
            }),
        ).toBeDisabled();

        expect(
            screen.getByRole('button', {
                name: 'Previous page',
            }),
        ).not.toBeDisabled();
    });

    it('represents a history API failure', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    message: 'Service unavailable',
                },
                503,
            ),
        );

        render(<HistoryList />);

        expect(await screen.findByRole('alert')).toHaveTextContent('History unavailable');

        expect(
            screen.getByRole('button', {
                name: 'Try again',
            }),
        ).toBeInTheDocument();
    });
});
