'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
    AuthApiError,
    getCurrentUser,
    loginUser,
    logoutUser,
    refreshAuthSession,
    registerUser,
    type AuthSession,
    type AuthUser,
} from '@/lib/auth-api';

import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

interface AuthProviderProps {
    readonly children: ReactNode;
}

const RECOVERY_ERROR_MESSAGE =
    'Unable to restore your authentication session. Check the API connection and try again.';

export function AuthProvider({ children }: AuthProviderProps) {
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [user, setUser] = useState<AuthUser | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const recoveryStartedRef = useRef(false);

    const clearAuthenticatedState = useCallback(() => {
        setUser(null);
        setAccessToken(null);
    }, []);

    const applyAuthenticatedSession = useCallback((session: AuthSession) => {
        setUser(session.user);
        setAccessToken(session.accessToken);
        setError(null);
        setStatus('authenticated');
    }, []);

    const recoverSession = useCallback(async () => {
        setStatus('loading');
        setError(null);

        try {
            const session = await refreshAuthSession();

            const currentUser = await getCurrentUser(session.accessToken);

            setUser(currentUser);
            setAccessToken(session.accessToken);
            setStatus('authenticated');
        } catch (caughtError) {
            clearAuthenticatedState();

            if (caughtError instanceof AuthApiError && caughtError.status === 401) {
                setStatus('unauthenticated');
                return;
            }

            setError(RECOVERY_ERROR_MESSAGE);
            setStatus('error');
        }
    }, [clearAuthenticatedState]);

    useEffect(() => {
        if (recoveryStartedRef.current) {
            return;
        }

        recoveryStartedRef.current = true;
        void recoverSession();
    }, [recoverSession]);

    const register = useCallback(
        async (email: string, password: string) => {
            const session = await registerUser(email, password);

            applyAuthenticatedSession(session);
        },
        [applyAuthenticatedSession],
    );

    const login = useCallback(
        async (email: string, password: string) => {
            const session = await loginUser(email, password);

            applyAuthenticatedSession(session);
        },
        [applyAuthenticatedSession],
    );

    const logout = useCallback(async () => {
        try {
            await logoutUser();
        } finally {
            clearAuthenticatedState();
            setError(null);
            setStatus('unauthenticated');
        }
    }, [clearAuthenticatedState]);

    const value = useMemo<AuthContextValue>(
        () => ({
            status,
            user,
            accessToken,
            error,
            register,
            login,
            logout,
            recoverSession,
        }),
        [status, user, accessToken, error, register, login, logout, recoverSession],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
