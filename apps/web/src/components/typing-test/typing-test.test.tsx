import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TYPING_WORD_COUNT } from '@typing-analytics/typing-core';
import { TypingTest } from './typing-test';

type TestAuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface TestAuthState {
    status: TestAuthStatus;
    accessToken: string | null;
}

const { authState } = vi.hoisted<{
    authState: TestAuthState;
}>(() => ({
    authState: {
        status: 'authenticated',
        accessToken: 'test-access-token',
    },
}));

vi.mock('@/auth/use-auth', () => ({
    useAuth: () => authState,
}));

const SERVER_TEXT = 'cat';

const CREATED_SESSION = {
    id: '11111111-1111-4111-8111-111111111111',
    typingText: {
        id: '22222222-2222-4222-8222-222222222222',
        text: SERVER_TEXT,
    },
};

const COMPLETED_SESSION = {
    id: CREATED_SESSION.id,
    typingText: CREATED_SESSION.typingText,
    durationMs: 1234,
    wpm: 73,
    rawWpm: 81,
    accuracy: 92.5,
    consistency: 88.4,
    totalInputs: 4,
    correctInputs: 3,
    incorrectInputs: 1,
    startedAt: '2026-10-01T20:00:00.000Z',
    completedAt: '2026-10-01T20:00:01.234Z',
};

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

function getCharacter(position: number) {
    return screen.getByTestId(`character-${String(position)}`);
}

async function waitForReadySession() {
    return screen.findByTestId('typing-surface');
}

async function typeAttempt(user: ReturnType<typeof userEvent.setup>, text: string) {
    const surface = await waitForReadySession();

    await user.click(surface);
    await user.keyboard(text);
}

beforeEach(() => {
    fetchMock.mockReset();
    authState.status = 'authenticated';
    authState.accessToken = 'test-access-token';
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('TypingTest persistent session integration', () => {
    it('shows creation loading and prevents typing before a persistent session exists', () => {
        fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

        render(<TypingTest />);

        expect(screen.getByTestId('persistence-status')).toHaveTextContent('creating');

        expect(screen.getByRole('status')).toHaveTextContent('Preparing your typing session');

        expect(screen.queryByTestId('typing-surface')).not.toBeInTheDocument();
    });

    it('renders the target text returned by the server and keeps typing local', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(CREATED_SESSION, 201));

        const user = userEvent.setup();

        render(<TypingTest />);

        await waitForReadySession();

        expect(screen.getByTestId('typing-text')).toHaveTextContent(SERVER_TEXT);

        expect(fetchMock).toHaveBeenCalledTimes(1);

        await typeAttempt(user, 'c');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'correct');

        expect(getCharacter(1)).toHaveAttribute('data-state', 'current');

        expect(screen.getByTestId('session-status')).toHaveTextContent('active');

        expect(fetchMock).toHaveBeenCalledTimes(1);

        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer test-access-token',
            },
        });
    });

    it('preserves incorrect input and Backspace behavior without remote keystroke requests', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(CREATED_SESSION, 201));

        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, 'x');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'incorrect');

        expect(fetchMock).toHaveBeenCalledTimes(1);

        await user.keyboard('{Backspace}');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'current');

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `0 / ${String(SERVER_TEXT.length)}`,
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('submits one replay batch on completion and renders the server-validated result', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(CREATED_SESSION, 201))
            .mockResolvedValueOnce(jsonResponse(COMPLETED_SESSION, 200));

        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, SERVER_TEXT);

        expect(await screen.findByTestId('typing-results')).toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledTimes(2);

        const secondCall = fetchMock.mock.calls[1];

        expect(secondCall[0]).toBe(
            `http://localhost:3001/typing-sessions/${CREATED_SESSION.id}/complete`,
        );

        const requestInit = secondCall[1];

        expect(requestInit).toMatchObject({
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer test-access-token',
            },
        });

        const requestBody = JSON.parse(requestInit?.body as string) as {
            inputs: Array<{
                type: 'insert';
                value: string;
                timestampMs: number;
            }>;
        };

        expect(requestBody.inputs).toHaveLength(3);

        expect(
            requestBody.inputs.map(({ type, value }) => ({
                type,
                value,
            })),
        ).toEqual([
            {
                type: 'insert',
                value: 'c',
            },
            {
                type: 'insert',
                value: 'a',
            },
            {
                type: 'insert',
                value: 't',
            },
        ]);

        for (const input of requestBody.inputs) {
            expect(typeof input.timestampMs).toBe('number');
            expect(Number.isFinite(input.timestampMs)).toBe(true);
        }

        expect(screen.getByTestId('result-wpm')).toHaveTextContent('73');

        expect(screen.getByTestId('result-accuracy')).toHaveTextContent('92.5%');

        expect(screen.getByTestId('result-errors')).toHaveTextContent('1');

        expect(screen.getByTestId('persistence-status')).toHaveTextContent('completed');
    });

    it('shows persistence loading until the server validates the completed session', async () => {
        let resolveCompletion!: (response: Response) => void;

        const completionPromise = new Promise<Response>((resolve) => {
            resolveCompletion = resolve;
        });

        fetchMock
            .mockResolvedValueOnce(jsonResponse(CREATED_SESSION, 201))
            .mockReturnValueOnce(completionPromise);

        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, SERVER_TEXT);

        await waitFor(() => {
            expect(screen.getByTestId('persistence-status')).toHaveTextContent('persisting');
        });

        expect(screen.getByRole('status')).toHaveTextContent('Validating your results');

        expect(screen.queryByTestId('typing-results')).not.toBeInTheDocument();

        resolveCompletion(jsonResponse(COMPLETED_SESSION, 200));

        expect(await screen.findByTestId('typing-results')).toBeInTheDocument();
    });

    it('represents session creation failure', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    message: 'Service unavailable',
                },
                503,
            ),
        );

        render(<TypingTest />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Session could not be created');

        expect(screen.queryByTestId('typing-surface')).not.toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Try again',
            }),
        ).toBeInTheDocument();
    });

    it('represents completion failure without showing unvalidated local results', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(CREATED_SESSION, 201)).mockResolvedValueOnce(
            jsonResponse(
                {
                    message: 'Completion failed',
                },
                500,
            ),
        );

        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, SERVER_TEXT);

        expect(await screen.findByRole('alert')).toHaveTextContent('Results could not be saved');

        expect(screen.queryByTestId('typing-results')).not.toBeInTheDocument();

        expect(
            screen.getByRole('button', {
                name: 'Start new test',
            }),
        ).toBeInTheDocument();
    });

    it('restart obtains a new persistent session instead of reusing the completed one', async () => {
        const restartedSession = {
            id: '33333333-3333-4333-8333-333333333333',
            typingText: {
                id: '44444444-4444-4444-8444-444444444444',
                text: 'dog',
            },
        };

        fetchMock
            .mockResolvedValueOnce(jsonResponse(CREATED_SESSION, 201))
            .mockResolvedValueOnce(jsonResponse(COMPLETED_SESSION, 200))
            .mockResolvedValueOnce(jsonResponse(restartedSession, 201));

        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, SERVER_TEXT);

        expect(await screen.findByTestId('typing-results')).toBeInTheDocument();

        await user.click(
            screen.getByRole('button', {
                name: 'Restart test',
            }),
        );

        expect(await screen.findByTestId('typing-surface')).toBeInTheDocument();

        expect(screen.getByTestId('typing-text')).toHaveTextContent('dog');

        expect(screen.queryByTestId('typing-results')).not.toBeInTheDocument();

        expect(fetchMock).toHaveBeenCalledTimes(3);

        expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3001/typing-sessions');
    });

    it('keeps guest typing completely local without creating persistent sessions', async () => {
        authState.status = 'unauthenticated';
        authState.accessToken = null;

        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const user = userEvent.setup();

        render(<TypingTest />);

        const surface = await screen.findByTestId('typing-surface');

        expect(screen.getByTestId('session-mode')).toHaveTextContent('guest');

        const targetText = screen.getByTestId('typing-text').textContent;

        expect(targetText).not.toBeNull();

        await user.click(surface);
        await user.keyboard(targetText);

        expect(await screen.findByTestId('typing-results')).toBeInTheDocument();

        expect(fetchMock).not.toHaveBeenCalled();

        expect(randomSpy).toHaveBeenCalledTimes(DEFAULT_TYPING_WORD_COUNT);
    });

    it('regenerates a local target when a guest restarts without persisting either session', async () => {
        authState.status = 'unauthenticated';
        authState.accessToken = null;

        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);

        const user = userEvent.setup();

        render(<TypingTest />);

        const surface = await screen.findByTestId('typing-surface');

        const targetText = screen.getByTestId('typing-text').textContent;

        expect(targetText).not.toBeNull();

        await user.click(surface);
        await user.keyboard(targetText);

        await screen.findByTestId('typing-results');

        await user.click(
            screen.getByRole('button', {
                name: 'Restart test',
            }),
        );

        expect(await screen.findByTestId('typing-surface')).toBeInTheDocument();

        expect(randomSpy).toHaveBeenCalledTimes(DEFAULT_TYPING_WORD_COUNT * 2);

        expect(fetchMock).not.toHaveBeenCalled();
    });
});
