'use client';

import { useEffect, useRef } from 'react';

import { LOCAL_TYPING_CONTENT } from '@/content/typing-content';
import { useTypingSession } from '@/hooks/use-typing-session';

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

    const { session, handleKeyDown } = useTypingSession(LOCAL_TYPING_CONTENT.text);

    const totalCharacters = Array.from(session.targetText).length;
    const totalLetters = countLetters(session.targetText);

    const completedLetters = getCompletedLetters(session.targetText, session.currentPosition);

    useEffect(() => {
        typingSurfaceRef.current?.focus();
    }, []);

    return (
        <section className="flex w-full flex-1 items-center">
            <div className="mx-auto w-full max-w-[1400px] px-6 py-16 sm:px-10 lg:py-24">
                <div className="mb-8 flex items-baseline gap-2 px-1 font-mono">
                    <span
                        data-testid="letter-progress"
                        className="text-2xl leading-none font-medium text-amber-300 sm:text-3xl"
                    >
                        {completedLetters}
                    </span>

                    <span className="text-sm text-zinc-700">/</span>

                    <span className="text-base text-zinc-500 sm:text-lg">{totalLetters}</span>

                    <span className="ml-1 text-[11px] tracking-[0.18em] text-zinc-600 uppercase">
                        letters
                    </span>

                    <span data-testid="session-status" className="sr-only">
                        {session.status}
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
                    className="mt-6 px-1 font-mono text-xs tracking-wide text-zinc-500 sm:text-sm"
                >
                    Type to begin
                    <span aria-hidden="true" className="mx-2 text-zinc-700">
                        ·
                    </span>
                    Backspace corrects the previous character
                </p>
            </div>
        </section>
    );
}
