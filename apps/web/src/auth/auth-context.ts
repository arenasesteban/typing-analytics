'use client';

import { createContext } from 'react';

import type { AuthUser } from '@/lib/auth-api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthContextValue {
    readonly status: AuthStatus;
    readonly user: AuthUser | null;
    readonly accessToken: string | null;
    readonly error: string | null;
    readonly register: (email: string, password: string) => Promise<void>;
    readonly login: (email: string, password: string) => Promise<void>;
    readonly logout: () => Promise<void>;
    readonly recoverSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
