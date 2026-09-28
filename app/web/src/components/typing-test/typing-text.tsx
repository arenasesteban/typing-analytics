import type { TypingSessionState } from '@typing-analytics/typing-core';

type CharacterVisualState = 'pending' | 'current' | 'correct' | 'incorrect';

interface TypingTextProps {
    readonly session: TypingSessionState;
}

const CHARACTER_STYLES: Record<CharacterVisualState, string> = {
    pending: 'text-subtle',
    current:
        "relative inline-block text-subtle before:absolute before:left-[-0.08em] before:top-1/2 before:h-[1.05em] before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-accent before:content-[''] before:animate-pulse",
    correct: 'text-foreground',
    incorrect: 'text-danger',
};

function getCharacterVisualState(
    session: TypingSessionState,
    position: number,
): CharacterVisualState {
    const typedCharacter = session.typedCharacters.at(position);

    if (typedCharacter !== undefined) {
        return typedCharacter.correct ? 'correct' : 'incorrect';
    }

    if (session.status !== 'completed' && position === session.currentPosition) {
        return 'current';
    }

    return 'pending';
}

export function TypingText({ session }: TypingTextProps) {
    const characters = Array.from(session.targetText);

    return (
        <p
            data-testid="typing-text"
            className="w-full text-[1.45rem] leading-[1.9] tracking-[0.045em] whitespace-pre-wrap sm:text-[1.65rem] lg:text-[1.8rem]"
        >
            {characters.map((character, position) => {
                const visualState = getCharacterVisualState(session, position);

                return (
                    <span
                        key={position}
                        data-testid={`character-${String(position)}`}
                        data-state={visualState}
                        className={`${CHARACTER_STYLES[visualState]} transition-colors duration-150 ease-out`}
                    >
                        {character}
                    </span>
                );
            })}
        </p>
    );
}
