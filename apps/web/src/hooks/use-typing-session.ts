'use client';

import {
    applyTypingInput,
    createTypingSession as createTypingSessionState,
    type TypingInput,
    type TypingSessionState,
} from '@typing-analytics/typing-core';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';

import {
    completeTypingSession,
    createTypingSession,
    type CompletedTypingSession,
    type CreatedTypingSession,
} from '@/lib/typing-sessions-api';

export type TypingStatus = 'creating' | 'ready' | 'persisting' | 'completed' | 'error';

export interface TypingError {
    readonly phase: 'creation' | 'completion';
    readonly message: string;
}

interface UseTypingSessionResult {
    readonly session: TypingSessionState | null;
    readonly status: TypingStatus;
    readonly result: CompletedTypingSession | null;
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
    const [session, setSession] = useState<TypingSessionState | null>(null);
    const [createdSession, setCreatedSession] = useState<CreatedTypingSession | null>(null);
    const [status, setStatus] = useState<TypingStatus>('creating');
    const [result, setResult] = useState<CompletedTypingSession | null>(null);
    const [error, setError] = useState<TypingError | null>(null);

    const sessionRef = useRef<TypingSessionState | null>(null);
    const inputsRef = useRef<TypingInput[]>([]);
    const completionRequestedRef = useRef(false);
    const lifecycleGenerationRef = useRef(0);
    const mountedRef = useRef(false);
    const initialCreationStartedRef = useRef(false);

    const beginSession = useCallback(async () => {
        const generation = lifecycleGenerationRef.current + 1;

        lifecycleGenerationRef.current = generation;
        completionRequestedRef.current = false;
        inputsRef.current = [];
        sessionRef.current = null;

        setSession(null);
        setCreatedSession(null);
        setResult(null);
        setError(null);
        setStatus('creating');

        try {
            const created = await createTypingSession();

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
                    'Unable to prepare a typing session. Check the API connection and try again.',
            });
            setStatus('error');
        }
    }, []);

    const submitCompletion = useCallback(
        async (
            createdSession: CreatedTypingSession,
            inputs: readonly TypingInput[],
            generation: number,
        ) => {
            try {
                const completedSession = await completeTypingSession(createdSession.id, inputs);

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

        if (!initialCreationStartedRef.current) {
            initialCreationStartedRef.current = true;
            void beginSession();
        }

        return () => {
            mountedRef.current = false;
        };
    }, [beginSession]);

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (status !== 'ready' || createdSession === null) {
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

            if (nextSession.status === 'completed' && !completionRequestedRef.current) {
                completionRequestedRef.current = true;
                setStatus('persisting');

                const generation = lifecycleGenerationRef.current;

                void submitCompletion(createdSession, nextInputs, generation);
            }
        },
        [createdSession, status, submitCompletion],
    );

    const restartSession = useCallback(() => {
        void beginSession();
    }, [beginSession]);

    return {
        session,
        status,
        result,
        error,
        handleKeyDown,
        restartSession,
    };
}
