'use client';

import { summarizeCompletedSession } from '@typing-analytics/typing-core';
import { useEffect, useRef } from 'react';

import { LOCAL_TYPING_CONTENT } from '@/content/typing-content';
import { useTypingSession } from '@/hooks/use-typing-session';

import { TypingResults } from './typing-results';
import { TypingText } from './typing-text';

function countLetters(text: string): number {
    return Array.from(text).filter((character) => /\p{L}/u.test(character)).length;
}

function getCompletedLetters(targetText: string, currentPosition: number): number {
    const completedText = Array.from(targetText).slice(0, currentPosition).join('');

    return countLetters(completedText);
}

export function TypingTest() {
    const typingSurfaceRef = useRef<HTMLDivElement>(null);

    const { session, handleKeyDown, restartSession } = useTypingSession(LOCAL_TYPING_CONTENT.text);

    const totalCharacters = Array.from(session.targetText).length;

    const totalLetters = countLetters(session.targetText);

    const completedLetters = getCompletedLetters(session.targetText, session.currentPosition);

    const summary = session.status === 'completed' ? summarizeCompletedSession(session) : null;

    useEffect(() => {
        if (session.status === 'idle') {
            typingSurfaceRef.current?.focus();
        }
    }, [session.status]);

    return (
        <section className="flex w-full flex-1 items-center">
            <div className="mx-auto w-full max-w-350 px-6 py-16 sm:px-10 lg:py-24">
                <span data-testid="session-status" className="sr-only">
                    {session.status}
                </span>

                {summary !== null ? (
                    <TypingResults summary={summary} onRestart={restartSession} />
                ) : (
                    <>
                        <div className="mb-8 flex items-baseline gap-2 px-1">
                            <span
                                data-testid="letter-progress"
                                className="text-accent text-2xl leading-none font-medium sm:text-3xl"
                            >
                                {completedLetters}
                            </span>

                            <span className="text-subtle text-sm">/</span>

                            <span className="text-muted text-base sm:text-lg">{totalLetters}</span>

                            <span className="text-subtle ml-1 text-[11px] tracking-[0.18em] uppercase">
                                letters
                            </span>

                            <span data-testid="current-position" className="sr-only">
                                {session.currentPosition} / {totalCharacters}
                            </span>
                        </div>

                        <div
                            ref={typingSurfaceRef}
                            data-testid="typing-surface"
                            tabIndex={0}
                            aria-label="Typing test input"
                            aria-describedby="typing-instructions"
                            onKeyDown={handleKeyDown}
                            onClick={() => typingSurfaceRef.current?.focus()}
                            className="w-full outline-none"
                        >
                            <div className="px-1 py-4">
                                <TypingText session={session} />
                            </div>
                        </div>

                        <p
                            id="typing-instructions"
                            className="text-muted mt-6 px-1 text-xs tracking-wide sm:text-sm"
                        >
                            Type to begin
                            <span aria-hidden="true" className="text-subtle mx-2">
                                ·
                            </span>
                            Backspace corrects the previous character
                        </p>
                    </>
                )}
            </div>
        </section>
    );
}
