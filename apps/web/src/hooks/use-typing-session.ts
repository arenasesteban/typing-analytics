'use client';

import {
    applyTypingInput,
    createTypingSession as createTypingSessionState,
    deriveSessionBehavioralResult,
    generateTypingText,
    summarizeCompletedSession,
    type SessionBehavioralResult,
    type TypingInput,
    type TypingSessionState,
} from '@typing-analytics/typing-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/auth/use-auth';
import {
    completeTypingSession,
    createTypingSession,
    type CompletedTypingSession,
    type CreatedTypingSession,
} from '@/lib/api/typing-sessions/api';

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
    readonly behavioral: SessionBehavioralResult | null;
    readonly error: TypingError | null;
    readonly handleTextInput: (value: string, timestampMs: number) => string;
    readonly restartSession: () => void;
}

function getEnteredText(session: TypingSessionState): string {
    return session.typedCharacters.map(({ enteredCharacter }) => enteredCharacter).join('');
}

function toTypingInput(
    previousValue: string,
    nextValue: string,
    timestampMs: number,
): TypingInput | null {
    const previous = Array.from(previousValue);
    const next = Array.from(nextValue);

    const isSingleAppend =
        next.length === previous.length + 1 &&
        previous.every((character, index) => character === next[index]);

    if (isSingleAppend) {
        const character = next.at(-1);

        if (character === undefined || character === '\n' || character === '\r') {
            return null;
        }

        return {
            type: 'insert',
            value: character,
            timestampMs,
        };
    }

    const isSingleBackspace =
        next.length === previous.length - 1 &&
        next.every((character, index) => character === previous[index]);

    if (isSingleBackspace) {
        return {
            type: 'backspace',
            timestampMs,
        };
    }

    return null;
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

    const behavioral = useMemo<SessionBehavioralResult | null>(() => {
        if (session?.status !== 'completed') {
            return null;
        }

        return deriveSessionBehavioralResult(session);
    }, [session]);

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
                        'The test finished locally, but the API could not confirm whether it was saved. Check your session history before starting a new test.',
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

    const handleTextInput = useCallback(
        (value: string, timestampMs: number): string => {
            const currentSession = sessionRef.current;

            if (currentSession === null) {
                return '';
            }

            const previousValue = getEnteredText(currentSession);

            if (status !== 'ready' || mode === null) {
                return previousValue;
            }

            const input = toTypingInput(previousValue, value, timestampMs);

            if (input === null) {
                return previousValue;
            }

            let nextSession: TypingSessionState;

            try {
                nextSession = applyTypingInput(currentSession, input);
            } catch (caughtError) {
                if (caughtError instanceof RangeError) {
                    return previousValue;
                }

                throw caughtError;
            }

            if (nextSession === currentSession) {
                return previousValue;
            }

            const nextInputs = [...inputsRef.current, input];

            inputsRef.current = nextInputs;
            sessionRef.current = nextSession;

            setSession(nextSession);

            if (nextSession.status !== 'completed' || completionRequestedRef.current) {
                return getEnteredText(nextSession);
            }

            completionRequestedRef.current = true;

            if (mode === 'guest') {
                setResult(summarizeCompletedSession(nextSession));
                setStatus('completed');

                return getEnteredText(nextSession);
            }

            if (createdSession === null || accessToken === null) {
                setError({
                    phase: 'completion',
                    message: 'The authenticated session is no longer available. Start a new test.',
                });

                setStatus('error');

                return getEnteredText(nextSession);
            }

            setStatus('persisting');

            const generation = lifecycleGenerationRef.current;

            void submitCompletion(accessToken, createdSession, nextInputs, generation);

            return getEnteredText(nextSession);
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
        behavioral,
        error,
        handleTextInput,
        restartSession,
    };
}
