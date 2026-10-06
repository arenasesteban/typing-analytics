'use client';

import { IconBrandGithub, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { useAuth } from '@/auth/use-auth';

const REPOSITORY_URL = 'https://github.com/arenasesteban/typing-analytics';

export function AppHeader() {
    const { status, user, logout } = useAuth();

    const [isLoggingOut, setIsLoggingOut] = useState(false);

    async function handleLogout(): Promise<void> {
        setIsLoggingOut(true);

        try {
            await logout();
        } catch {
            // AuthProvider still clears browser authentication state.
        } finally {
            setIsLoggingOut(false);
        }
    }

    return (
        <header className="border-border border-b">
            <div className="mx-auto flex min-h-14 w-full max-w-350 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:flex-nowrap sm:px-6 lg:px-10">
                <Link href="/" className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden="true"
                        className="bg-accent-strong size-2 shrink-0 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                    />

                    <span className="text-foreground text-sm font-medium tracking-[0.06em] whitespace-nowrap sm:text-base">
                        typing-analytics
                    </span>
                </Link>

                <nav
                    aria-label="Application links"
                    className="flex items-center justify-end gap-2 text-xs sm:gap-3"
                >
                    {status === 'loading' ? (
                        <span role="status" aria-live="polite" className="text-subtle px-2">
                            checking session
                        </span>
                    ) : null}

                    {status === 'authenticated' && user !== null ? (
                        <>
                            <div
                                className="text-muted flex min-w-0 items-center gap-1.5 px-1"
                                title={user.email}
                            >
                                <IconUser size={16} stroke={1.75} aria-hidden="true" />
                                <span className="hidden max-w-44 truncate sm:inline md:max-w-56">
                                    {user.email}
                                </span>
                            </div>

                            <button
                                type="button"
                                disabled={isLoggingOut}
                                onClick={() => void handleLogout()}
                                className="border-border text-foreground-secondary hover:border-accent/60 hover:text-accent focus-visible:ring-accent cursor-pointer border px-3 py-1.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isLoggingOut ? 'signing out…' : 'sign out'}
                            </button>
                        </>
                    ) : null}

                    {status === 'unauthenticated' || status === 'error' ? (
                        <>
                            <Link
                                href="/login"
                                className="border-border text-foreground-secondary hover:border-accent/60 hover:text-accent focus-visible:ring-accent border px-3 py-1.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                sign in
                            </Link>

                            <Link
                                href="/register"
                                className="border-accent/70 text-accent hover:border-accent hover:bg-accent/10 focus-visible:ring-accent border px-3 py-1.5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                register
                            </Link>
                        </>
                    ) : null}

                    <div className="border-border ml-1 border-l pl-3">
                        <a
                            href={REPOSITORY_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="repository"
                            title="GitHub repository"
                            className="text-muted hover:text-foreground focus-visible:text-accent focus-visible:ring-accent flex size-8 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
                        >
                            <IconBrandGithub size={18} stroke={1.75} aria-hidden="true" />
                        </a>
                    </div>
                </nav>
            </div>
        </header>
    );
}
