'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/auth/use-auth';

interface ProtectedRouteProps {
    readonly children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const router = useRouter();

    const { status, error, recoverSession } = useAuth();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.replace('/login');
        }
    }, [router, status]);

    if (status === 'loading') {
        return (
            <div role="status" aria-live="polite">
                Checking your session…
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div role="alert">
                <p>{error}</p>

                <button type="button" onClick={() => void recoverSession()}>
                    Try again
                </button>
            </div>
        );
    }

    if (status === 'unauthenticated') {
        return null;
    }

    return children;
}
