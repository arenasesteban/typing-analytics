import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppHeader } from './app-header';

const { authState } = vi.hoisted(() => {
    const logout = vi.fn(() => Promise.resolve());

    const authState: {
        status: 'authenticated' | 'unauthenticated';
        user: {
            id: string;
            email: string;
        } | null;
        logout: typeof logout;
    } = {
        status: 'authenticated',
        user: {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'user@example.com',
        },
        logout,
    };

    return {
        authState,
    };
});

vi.mock('@/auth/use-auth', () => ({
    useAuth: () => authState,
}));

beforeEach(() => {
    authState.status = 'authenticated';

    authState.user = {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'user@example.com',
    };

    authState.logout.mockClear();
});

describe('AppHeader account menu', () => {
    it('exposes private actions through the authenticated account menu', async () => {
        const user = userEvent.setup();

        render(<AppHeader />);

        expect(
            screen.queryByRole('menuitem', {
                name: 'history',
            }),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole('menuitem', {
                name: 'sign out',
            }),
        ).not.toBeInTheDocument();

        const trigger = screen.getByRole('button', {
            name: 'Account menu',
        });

        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await user.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        expect(
            screen.getByRole('menu', {
                name: 'Account menu',
            }),
        ).toBeInTheDocument();

        const historyItem = screen.getByRole('menuitem', {
            name: 'history',
        });

        expect(historyItem).toHaveAttribute('href', '/history');

        expect(
            screen.getByRole('menuitem', {
                name: 'sign out',
            }),
        ).toBeInTheDocument();
    });

    it('does not expose the account menu to unauthenticated users', () => {
        authState.status = 'unauthenticated';

        authState.user = null;

        render(<AppHeader />);

        expect(
            screen.queryByRole('button', {
                name: 'Account menu',
            }),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole('menuitem', {
                name: 'history',
            }),
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole('link', {
                name: 'sign in',
            }),
        ).toHaveAttribute('href', '/login');

        expect(
            screen.getByRole('link', {
                name: 'register',
            }),
        ).toHaveAttribute('href', '/register');
    });
});
