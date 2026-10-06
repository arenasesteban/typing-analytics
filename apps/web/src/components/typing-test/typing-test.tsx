'use client';

import { useEffect, useRef } from 'react';

import { useTypingSession, type TypingError } from '@/hooks/use-typing-session';

import { TypingResults } from './typing-results';
import { TypingText } from './typing-text';

function countLetters(text: string): number {
    return Array.from(text).filter((character) => /\p{L}/u.test(character)).length;
}

function getCompletedLetters(targetText: string, currentPosition: number): number {
    const completedText = Array.from(targetText).slice(0, currentPosition).join('');

    return countLetters(completedText);
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

            <h2 className="text-foreground mt-3 text-2xl font-semibold">{title}</h2>

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

    const { mode, session, status, result, error, handleKeyDown, restartSession } =
        useTypingSession();

    useEffect(() => {
        if (status === 'ready' && session?.status === 'idle') {
            typingSurfaceRef.current?.focus();
        }
    }, [session?.status, status]);

    const totalCharacters = session === null ? 0 : Array.from(session.targetText).length;

    const totalLetters = session === null ? 0 : countLetters(session.targetText);

    const completedLetters =
        session === null ? 0 : getCompletedLetters(session.targetText, session.currentPosition);

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
                        persisted={mode === 'authenticated'}
                        onRestart={restartSession}
                    />
                ) : null}

                {status === 'ready' && session !== null ? (
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
                ) : null}
            </div>
        </section>
    );
}
