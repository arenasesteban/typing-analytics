'use client';

import {
    applyTypingInput,
    createTypingSession,
    type TypingSessionState,
} from '@typing-analytics/typing-core';
import { useCallback, useState, type KeyboardEvent } from 'react';

interface UseTypingSessionResult {
    readonly session: TypingSessionState;
    readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export function useTypingSession(targetText: string): UseTypingSessionResult {
    const [session, setSession] = useState<TypingSessionState>(() =>
        createTypingSession(targetText),
    );

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
        if (
            event.defaultPrevented ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            event.key === 'Tab'
        ) {
            return;
        }

        event.preventDefault();

        if (event.key === 'Backspace') {
            setSession((currentSession) =>
                applyTypingInput(currentSession, {
                    type: 'backspace',
                    timestampMs: event.timeStamp,
                }),
            );

            return;
        }

        setSession((currentSession) =>
            applyTypingInput(currentSession, {
                type: 'insert',
                value: event.key,
                timestampMs: event.timeStamp,
            }),
        );
    }, []);

    return {
        session,
        handleKeyDown,
    };
}
