'use client';

import {
    applyTypingInput,
    createTypingSession as createTypingSessionState,
    generateTypingText,
    summarizeCompletedSession,
    type TypingInput,
    type TypingSessionState,
} from '@typing-analytics/typing-core';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { useAuth } from '@/auth/use-auth';
import {
    completeTypingSession,
    createTypingSession,
    type CompletedTypingSession,
    type CreatedTypingSession,
} from '@/lib/typing-sessions-api';

export type TypingSessionMode = 'guest' | 'authenticated';

export type TypingStatus = 'creating' | 'ready' | 'persisting' | 'completed' | 'error';

export interface TypingError {
    readonly phase: 'creation' | 'completion';
    readonly message: string;
}

type LocalTypingResult = ReturnType<typeof summarizeCompletedSession>;

type TypingResult = LocalTypingResult | CompletedTypingSession;

interface UseTypingSessionResult {
    readonly mode: TypingSessionMode | null;
    readonly session: TypingSessionState | null;
    readonly status: TypingStatus;
    readonly result: TypingResult | null;
    readonly error: TypingError | null;
    readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    readonly restartSession: () => void;
}

function toTypingInput(event: KeyboardEvent<HTMLElement>): TypingInput | null {
    if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.key === 'Tab'
    ) {
        return null;
    }

    if (event.key === 'Backspace') {
        return {
            type: 'backspace',
            timestampMs: event.timeStamp,
        };
    }

    if (Array.from(event.key).length !== 1) {
        return null;
    }

    return {
        type: 'insert',
        value: event.key,
        timestampMs: event.timeStamp,
    };
}

export function useTypingSession(): UseTypingSessionResult {
    const { status: authStatus, accessToken } = useAuth();

    const [mode, setMode] = useState<TypingSessionMode | null>(null);

    const [session, setSession] = useState<TypingSessionState | null>(null);

    const [createdSession, setCreatedSession] = useState<CreatedTypingSession | null>(null);

    const [status, setStatus] = useState<TypingStatus>('creating');

    const [result, setResult] = useState<TypingResult | null>(null);

    const [error, setError] = useState<TypingError | null>(null);

    const sessionRef = useRef<TypingSessionState | null>(null);

    const inputsRef = useRef<TypingInput[]>([]);
    const completionRequestedRef = useRef(false);
    const lifecycleGenerationRef = useRef(0);
    const mountedRef = useRef(false);

    const activeModeRef = useRef<TypingSessionMode | null>(null);

    const beginSession = useCallback(async (nextMode: TypingSessionMode, token: string | null) => {
        const generation = lifecycleGenerationRef.current + 1;

        lifecycleGenerationRef.current = generation;
        completionRequestedRef.current = false;
        inputsRef.current = [];
        sessionRef.current = null;
        activeModeRef.current = nextMode;

        setMode(nextMode);
        setSession(null);
        setCreatedSession(null);
        setResult(null);
        setError(null);
        setStatus('creating');

        try {
            if (nextMode === 'guest') {
                const targetText = generateTypingText();

                const localSession = createTypingSessionState(targetText);

                if (!mountedRef.current || lifecycleGenerationRef.current !== generation) {
                    return;
                }

                sessionRef.current = localSession;

                setSession(localSession);
                setStatus('ready');

                return;
            }

            if (token === null) {
                throw new Error('Authenticated typing session requires an access token');
            }

            const created = await createTypingSession(token);

            if (!mountedRef.current || lifecycleGenerationRef.current !== generation) {
                return;
            }

            const localSession = createTypingSessionState(created.typingText.text);

            sessionRef.current = localSession;

            setCreatedSession(created);
            setSession(localSession);
            setStatus('ready');
        } catch {
            if (!mountedRef.current || lifecycleGenerationRef.current !== generation) {
                return;
            }

            setError({
                phase: 'creation',
                message:
                    nextMode === 'authenticated'
                        ? 'Unable to prepare a saved typing session. Check the API connection and try again.'
                        : 'Unable to prepare a local typing test. Try again.',
            });

            setStatus('error');
        }
    }, []);

    const submitCompletion = useCallback(
        async (
            token: string,
            persistedSession: CreatedTypingSession,
            inputs: readonly TypingInput[],
            generation: number,
        ) => {
            try {
                const completedSession = await completeTypingSession(
                    token,
                    persistedSession.id,
                    inputs,
                );

                if (!mountedRef.current || lifecycleGenerationRef.current !== generation) {
                    return;
                }

                setResult(completedSession);
                setStatus('completed');
            } catch {
                if (!mountedRef.current || lifecycleGenerationRef.current !== generation) {
                    return;
                }

                setError({
                    phase: 'completion',
                    message:
                        'The test finished locally, but the validated result could not be saved. Start a new test.',
                });

                setStatus('error');
            }
        },
        [],
    );

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (authStatus === 'loading') {
            return;
        }

        const nextMode: TypingSessionMode =
            authStatus === 'authenticated' && accessToken !== null ? 'authenticated' : 'guest';

        if (activeModeRef.current === nextMode) {
            return;
        }

        void beginSession(nextMode, nextMode === 'authenticated' ? accessToken : null);
    }, [accessToken, authStatus, beginSession]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (status !== 'ready' || mode === null) {
                return;
            }

            const input = toTypingInput(event);

            if (input === null) {
                return;
            }

            const currentSession = sessionRef.current;

            if (currentSession === null) {
                return;
            }

            event.preventDefault();

            let nextSession: TypingSessionState;

            try {
                nextSession = applyTypingInput(currentSession, input);
            } catch (caughtError) {
                if (caughtError instanceof RangeError) {
                    return;
                }

                throw caughtError;
            }

            if (nextSession === currentSession) {
                return;
            }

            const nextInputs = [...inputsRef.current, input];

            inputsRef.current = nextInputs;
            sessionRef.current = nextSession;

            setSession(nextSession);

            if (nextSession.status !== 'completed' || completionRequestedRef.current) {
                return;
            }

            completionRequestedRef.current = true;

            if (mode === 'guest') {
                setResult(summarizeCompletedSession(nextSession));

                setStatus('completed');

                return;
            }

            if (createdSession === null || accessToken === null) {
                setError({
                    phase: 'completion',
                    message: 'The authenticated session is no longer available. Start a new test.',
                });

                setStatus('error');

                return;
            }

            setStatus('persisting');

            const generation = lifecycleGenerationRef.current;

            void submitCompletion(accessToken, createdSession, nextInputs, generation);
        },
        [accessToken, createdSession, mode, status, submitCompletion],
    );

    const restartSession = useCallback(() => {
        if (mode === null) {
            return;
        }

        void beginSession(mode, mode === 'authenticated' ? accessToken : null);
    }, [accessToken, beginSession, mode]);

    return {
        mode,
        session,
        status,
        result,
        error,
        handleKeyDown,
        restartSession,
    };
}
