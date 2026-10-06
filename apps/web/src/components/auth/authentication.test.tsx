import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/auth-provider';
import { AppHeader } from '@/components/layout/app-header';

import { AuthForm } from './auth-form';
import { ProtectedRoute } from './protected-route';

const { replaceMock } = vi.hoisted(() => ({
    replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
}));

const fetchMock = vi.fn<typeof fetch>();

const AUTH_USER = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@example.com',
};

const AUTH_SESSION = {
    accessToken: 'short-lived-access-token',
    user: AUTH_USER,
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

function emptyResponse(status = 204): Response {
    return new Response(null, {
        status,
    });
}

function renderWithAuth(ui: React.ReactNode) {
    return render(<AuthProvider>{ui}</AuthProvider>);
}

beforeEach(() => {
    fetchMock.mockReset();
    replaceMock.mockReset();

    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('browser authentication flows', () => {
    it('recovers authentication through refresh and loads the current identity', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(AUTH_SESSION, 200))
            .mockResolvedValueOnce(jsonResponse(AUTH_USER, 200));

        renderWithAuth(<AppHeader />);

        expect(await screen.findByText('user@example.com')).toBeInTheDocument();

        expect(fetchMock.mock.calls[0]?.[0]).toBe('http://localhost:3001/auth/refresh');

        expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
            method: 'POST',
            credentials: 'include',
        });

        expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3001/auth/me');

        expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
            method: 'GET',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer short-lived-access-token',
            },
        });
    });

    it('allows a user to sign in without persisting authentication secrets in browser storage', async () => {
        const storageSpy = vi.spyOn(Storage.prototype, 'setItem');

        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(
                    {
                        message: 'Invalid or expired authentication session',
                    },
                    401,
                ),
            )
            .mockResolvedValueOnce(jsonResponse(AUTH_SESSION, 200));

        const user = userEvent.setup();

        renderWithAuth(<AuthForm mode="login" />);

        const emailInput = await screen.findByLabelText('Email');

        await user.type(emailInput, 'user@example.com');

        await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');

        await user.click(
            screen.getByRole('button', {
                name: 'Sign in',
            }),
        );

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/');
        });

        expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3001/auth/login');

        expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
            method: 'POST',
            credentials: 'include',
        });

        expect(storageSpy).not.toHaveBeenCalled();
    });

    it('allows a user to register through the UI', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(
                    {
                        message: 'Invalid or expired authentication session',
                    },
                    401,
                ),
            )
            .mockResolvedValueOnce(jsonResponse(AUTH_SESSION, 201));

        const user = userEvent.setup();

        renderWithAuth(<AuthForm mode="register" />);

        await user.type(await screen.findByLabelText('Email'), 'user@example.com');

        await user.type(screen.getByLabelText('Password'), 'correct-horse-battery-staple');

        await user.click(
            screen.getByRole('button', {
                name: 'Create account',
            }),
        );

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/');
        });

        expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:3001/auth/register');
    });

    it('represents invalid credentials as an understandable error state', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse(
                    {
                        message: 'Invalid or expired authentication session',
                    },
                    401,
                ),
            )
            .mockResolvedValueOnce(
                jsonResponse(
                    {
                        message: 'Invalid credentials',
                    },
                    401,
                ),
            );

        const user = userEvent.setup();

        renderWithAuth(<AuthForm mode="login" />);

        await user.type(await screen.findByLabelText('Email'), 'user@example.com');

        await user.type(screen.getByLabelText('Password'), 'incorrect-password');

        await user.click(
            screen.getByRole('button', {
                name: 'Sign in',
            }),
        );

        expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    });

    it('does not render protected content while authentication recovery is loading', () => {
        fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

        renderWithAuth(
            <ProtectedRoute>
                <div>private content</div>
            </ProtectedRoute>,
        );

        expect(screen.getByRole('status')).toHaveTextContent('Checking your session');

        expect(screen.queryByText('private content')).not.toBeInTheDocument();
    });

    it('redirects unauthenticated protected navigation to login', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    message: 'Invalid or expired authentication session',
                },
                401,
            ),
        );

        renderWithAuth(
            <ProtectedRoute>
                <div>private content</div>
            </ProtectedRoute>,
        );

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/login');
        });

        expect(screen.queryByText('private content')).not.toBeInTheDocument();
    });

    it('logs out and removes authenticated browser state', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(AUTH_SESSION, 200))
            .mockResolvedValueOnce(jsonResponse(AUTH_USER, 200))
            .mockResolvedValueOnce(emptyResponse(204));

        const user = userEvent.setup();

        renderWithAuth(<AppHeader />);

        await user.click(
            await screen.findByRole('button', {
                name: 'sign out',
            }),
        );

        expect(
            await screen.findByRole('link', {
                name: 'sign in',
            }),
        ).toBeInTheDocument();

        expect(fetchMock.mock.calls[2]?.[0]).toBe('http://localhost:3001/auth/logout');

        expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
            method: 'POST',
            credentials: 'include',
        });
    });
});
