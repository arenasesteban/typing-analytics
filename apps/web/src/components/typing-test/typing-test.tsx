'use client';

import { useEffect, useRef } from 'react';

import { useTypingSession, type TypingError } from '@/hooks/use-typing-session';

import { TypingResults } from './typing-results';
import { TypingText } from './typing-text';

interface WordProgress {
    readonly completedWords: number;
    readonly totalWords: number;
}

function getWordProgress(targetText: string, currentPosition: number): WordProgress {
    const characters = Array.from(targetText);

    let completedWords = 0;
    let totalWords = 0;
    let insideWord = false;

    for (let index = 0; index <= characters.length; index += 1) {
        const character = characters[index];
        const isBoundary = index === characters.length || /\s/u.test(character);

        if (isBoundary && insideWord) {
            totalWords += 1;

            if (currentPosition >= index) {
                completedWords += 1;
            }

            insideWord = false;
        } else if (!isBoundary) {
            insideWord = true;
        }
    }

    return { completedWords, totalWords };
}

interface AsyncStateProps {
    readonly title: string;
    readonly description: string;
    readonly role: 'status' | 'alert';
    readonly actionLabel?: string;
    readonly onAction?: () => void;
}

function AsyncState({ title, description, role, actionLabel, onAction }: AsyncStateProps) {
    return (
        <div
            role={role}
            aria-live={role === 'status' ? 'polite' : 'assertive'}
            className="max-w-2xl"
        >
            <p className="text-accent text-xs tracking-[0.16em] uppercase">typing session</p>

            <h1 className="text-foreground mt-3 text-2xl font-semibold">{title}</h1>

            <p className="text-muted mt-3 text-sm leading-6">{description}</p>

            {actionLabel !== undefined && onAction !== undefined ? (
                <button
                    type="button"
                    onClick={onAction}
                    className="border-border text-foreground-secondary hover:border-accent/50 hover:text-accent focus-visible:ring-accent mt-8 cursor-pointer border px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}

function getErrorActionLabel(error: TypingError): string {
    return error.phase === 'creation' ? 'Try again' : 'Start new test';
}

export function TypingTest() {
    const typingSurfaceRef = useRef<HTMLDivElement>(null);

    const { mode, session, status, result, behavioral, error, handleKeyDown, restartSession } =
        useTypingSession();

    useEffect(() => {
        if (status === 'ready' && session?.status === 'idle') {
            typingSurfaceRef.current?.focus();
        }

        if (status === 'completed' && result !== null) {
            document.getElementById('typing-results-title')?.focus();
        }
    }, [session?.status, status, result]);

    const totalCharacters = session === null ? 0 : Array.from(session.targetText).length;

    const { completedWords, totalWords } =
        session === null
            ? { completedWords: 0, totalWords: 0 }
            : getWordProgress(session.targetText, session.currentPosition);

    return (
        <section className="flex w-full flex-1 items-center">
            <div className="mx-auto w-full max-w-350 px-6 py-16 sm:px-10 lg:py-24">
                <span data-testid="persistence-status" className="sr-only">
                    {status}
                </span>

                <span data-testid="session-mode" className="sr-only">
                    {mode ?? 'unresolved'}
                </span>

                <span data-testid="session-status" className="sr-only">
                    {session?.status ?? 'unavailable'}
                </span>

                {status === 'creating' ? (
                    <AsyncState
                        role="status"
                        title="Preparing your typing session"
                        description={
                            mode === 'authenticated'
                                ? 'Creating an owned persistent session and loading its server-assigned text.'
                                : mode === 'guest'
                                  ? 'Generating a local typing test. Guest results are not saved.'
                                  : 'Checking authentication before preparing your typing test.'
                        }
                    />
                ) : null}

                {status === 'persisting' ? (
                    <AsyncState
                        role="status"
                        title="Validating your results"
                        description="Your typing is complete. The server is replaying the session and saving the validated result."
                    />
                ) : null}

                {status === 'error' && error !== null ? (
                    <AsyncState
                        role="alert"
                        title={
                            error.phase === 'creation'
                                ? 'Session could not be created'
                                : 'Results could not be saved'
                        }
                        description={error.message}
                        actionLabel={getErrorActionLabel(error)}
                        onAction={restartSession}
                    />
                ) : null}

                {status === 'completed' && result !== null ? (
                    <TypingResults
                        summary={result}
                        temporal={behavioral?.temporal}
                        persisted={mode === 'authenticated'}
                        onRestart={restartSession}
                    />
                ) : null}

                {status === 'ready' && session !== null ? (
                    <>
                        <h1 className="sr-only">Typing test</h1>

                        <p className="sr-only">
                            {completedWords} of {totalWords} words completed.
                        </p>

                        <div aria-hidden="true" className="mb-8 flex items-baseline gap-2 px-1">
                            <span
                                data-testid="word-progress"
                                className="text-accent text-2xl leading-none font-medium sm:text-3xl"
                            >
                                {completedWords}
                            </span>

                            <span className="text-subtle text-sm">/</span>

                            <span className="text-muted text-base sm:text-lg">{totalWords}</span>

                            <span className="text-subtle ml-1 text-[11px] tracking-[0.18em] uppercase">
                                words
                            </span>
                        </div>

                        <span data-testid="current-position" hidden>
                            {session.currentPosition} / {totalCharacters}
                        </span>

                        <div
                            ref={typingSurfaceRef}
                            data-testid="typing-surface"
                            role="group"
                            tabIndex={0}
                            aria-label="Typing test input"
                            aria-describedby="typing-instructions typing-target-readable"
                            onKeyDown={handleKeyDown}
                            onClick={() => typingSurfaceRef.current?.focus()}
                            className="w-full outline-none"
                        >
                            <p id="typing-target-readable" className="sr-only">
                                Target text: {session.targetText}
                            </p>

                            <div aria-hidden="true" className="px-1 py-4">
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
                ) : null}
            </div>
        </section>
    );
}
