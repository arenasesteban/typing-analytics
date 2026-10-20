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

        const trigger = screen.getByRole('button', {
            name: /^Account menu\b/,
        });

        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        expect(document.getElementById('account-menu')).toBeNull();

        expect(
            screen.queryByRole('link', {
                name: 'history',
            }),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole('button', {
                name: 'sign out',
            }),
        ).not.toBeInTheDocument();

        await user.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        const menu = document.getElementById('account-menu');

        expect(menu).not.toBeNull();
        expect(menu).toBeVisible();

        expect(
            screen.getByRole('link', {
                name: 'history',
            }),
        ).toHaveAttribute('href', '/history');

        expect(
            screen.getByRole('button', {
                name: 'sign out',
            }),
        ).toBeInTheDocument();
    });

    it('does not expose the account menu to unauthenticated users', () => {
        authState.status = 'unauthenticated';
        authState.user = null;

        render(<AppHeader />);

        expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'history' })).not.toBeInTheDocument();
        expect(document.getElementById('account-menu')).toBeNull();

        expect(screen.getByRole('link', { name: 'sign in' })).toHaveAttribute('href', '/login');
        expect(screen.getByRole('link', { name: 'register' })).toHaveAttribute('href', '/register');
    });

    it('closes the account disclosure with Escape and restores focus', async () => {
        const user = userEvent.setup();

        render(<AppHeader />);

        const trigger = screen.getByRole('button', {
            name: /^Account menu\b/,
        });

        await user.click(trigger);

        const historyLink = screen.getByRole('link', {
            name: 'history',
        });

        historyLink.focus();
        expect(historyLink).toHaveFocus();

        await user.keyboard('{Escape}');

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveFocus();
        expect(screen.queryByRole('link', { name: 'history' })).not.toBeInTheDocument();
    });

    it('allows ordinary Tab navigation through account actions', async () => {
        const user = userEvent.setup();

        render(<AppHeader />);

        const trigger = screen.getByRole('button', {
            name: /^Account menu\b/,
        });

        await user.click(trigger);
        trigger.focus();

        await user.tab();
        expect(screen.getByRole('link', { name: 'dashboard' })).toHaveFocus();

        await user.tab();
        expect(screen.getByRole('link', { name: 'history' })).toHaveFocus();

        await user.tab();
        expect(screen.getByRole('button', { name: 'sign out' })).toHaveFocus();
    });
});
