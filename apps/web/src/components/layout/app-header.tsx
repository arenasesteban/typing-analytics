'use client';

import {
    IconBrandGithub,
    IconChevronDown,
    IconHistory,
    IconLogout,
    IconUser,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/auth/use-auth';

const REPOSITORY_URL = 'https://github.com/arenasesteban/typing-analytics';

export function AppHeader() {
    const { status, user, logout } = useAuth();

    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const accountMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handlePointerDown(event: PointerEvent): void {
            const target = event.target;

            if (
                !(target instanceof Node) ||
                accountMenuRef.current === null ||
                accountMenuRef.current.contains(target)
            ) {
                return;
            }

            setIsAccountMenuOpen(false);
        }

        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                setIsAccountMenuOpen(false);
            }
        }

        document.addEventListener('pointerdown', handlePointerDown);

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);

            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    async function handleLogout(): Promise<void> {
        setIsAccountMenuOpen(false);
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
                        <div ref={accountMenuRef} className="relative">
                            <button
                                type="button"
                                aria-label="Account menu"
                                aria-haspopup="menu"
                                aria-expanded={isAccountMenuOpen}
                                aria-controls="account-menu"
                                onClick={() => {
                                    setIsAccountMenuOpen((current) => !current);
                                }}
                                className="text-muted hover:text-foreground focus-visible:text-accent focus-visible:ring-accent flex cursor-pointer items-center gap-2 px-2 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                            >
                                <IconUser size={16} stroke={1.75} aria-hidden="true" />

                                <span className="hidden max-w-52 truncate sm:inline">
                                    {user.email}
                                </span>

                                <IconChevronDown
                                    size={14}
                                    stroke={1.75}
                                    aria-hidden="true"
                                    className={`transition-transform ${
                                        isAccountMenuOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>

                            {isAccountMenuOpen ? (
                                <div
                                    id="account-menu"
                                    role="menu"
                                    aria-label="Account menu"
                                    className="border-border-strong bg-background absolute top-full right-0 z-50 mt-2 min-w-48 border p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                                >
                                    <Link
                                        href="/history"
                                        role="menuitem"
                                        onClick={() => {
                                            setIsAccountMenuOpen(false);
                                        }}
                                        className="text-muted hover:bg-surface-raised hover:text-accent focus-visible:bg-surface-raised focus-visible:text-accent flex items-center gap-2.5 px-3 py-2 text-xs tracking-[0.04em] transition-colors focus-visible:outline-none"
                                    >
                                        <IconHistory size={15} stroke={1.75} aria-hidden="true" />

                                        <span>history</span>
                                    </Link>

                                    <div
                                        aria-hidden="true"
                                        className="border-border mx-2 border-t"
                                    />

                                    <button
                                        type="button"
                                        role="menuitem"
                                        disabled={isLoggingOut}
                                        onClick={() => void handleLogout()}
                                        className="text-muted hover:bg-surface-raised hover:text-accent focus-visible:bg-surface-raised focus-visible:text-accent flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs tracking-[0.04em] transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <IconLogout size={15} stroke={1.75} aria-hidden="true" />

                                        <span>{isLoggingOut ? 'signing out…' : 'sign out'}</span>
                                    </button>
                                </div>
                            ) : null}
                        </div>
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
