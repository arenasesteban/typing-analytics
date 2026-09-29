import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LOCAL_TYPING_CONTENT } from '@/content/typing-content';

import { TypingTest } from './typing-test';

const TOTAL_CHARACTERS = Array.from(LOCAL_TYPING_CONTENT.text).length;

function getCharacter(position: number) {
    return screen.getByTestId(`character-${String(position)}`);
}

async function typeAttempt(user: ReturnType<typeof userEvent.setup>, text: string) {
    const surface = screen.getByTestId('typing-surface');

    await user.click(surface);
    await user.keyboard(text);
}

describe('TypingTest', () => {
    it('renders the bundled local text before typing begins', () => {
        render(<TypingTest />);

        expect(screen.getByTestId('typing-text')).toHaveTextContent(LOCAL_TYPING_CONTENT.text);

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `0 / ${String(TOTAL_CHARACTERS)}`,
        );

        expect(screen.getByTestId('letter-progress')).toHaveTextContent('0');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'current');
        expect(getCharacter(1)).toHaveAttribute('data-state', 'pending');

        expect(screen.queryByTestId('typing-results')).not.toBeInTheDocument();
    });

    it('forwards correct keyboard input to the domain and advances the current position', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        const firstCharacter = LOCAL_TYPING_CONTENT.text.slice(0, 1);

        await typeAttempt(user, firstCharacter);

        expect(getCharacter(0)).toHaveAttribute('data-state', 'correct');
        expect(getCharacter(1)).toHaveAttribute('data-state', 'current');

        expect(screen.getByTestId('session-status')).toHaveTextContent('active');

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `1 / ${String(TOTAL_CHARACTERS)}`,
        );

        expect(screen.getByTestId('letter-progress')).toHaveTextContent('1');
    });

    it('renders incorrect input using the incorrect visual state', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, 'x');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'incorrect');
        expect(getCharacter(1)).toHaveAttribute('data-state', 'current');

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `1 / ${String(TOTAL_CHARACTERS)}`,
        );
    });

    it('forwards Backspace to the domain and restores the current position', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, 'x');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'incorrect');

        await user.keyboard('{Backspace}');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'current');

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `0 / ${String(TOTAL_CHARACTERS)}`,
        );

        expect(screen.getByTestId('letter-progress')).toHaveTextContent('0');
    });

    it('shows results only after the typing session completes', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        expect(screen.queryByTestId('typing-results')).not.toBeInTheDocument();

        await typeAttempt(user, LOCAL_TYPING_CONTENT.text);

        expect(screen.getByTestId('session-status')).toHaveTextContent('completed');

        expect(screen.getByTestId('typing-results')).toBeInTheDocument();

        expect(screen.queryByTestId('typing-surface')).not.toBeInTheDocument();

        expect(screen.queryByTestId('current-position')).not.toBeInTheDocument();

        expect(screen.queryByTestId('letter-progress')).not.toBeInTheDocument();
    });

    it('renders the approved result summary from the completed session', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        await typeAttempt(user, LOCAL_TYPING_CONTENT.text);

        expect(screen.getByTestId('result-wpm')).toBeInTheDocument();

        expect(screen.getByTestId('result-raw-wpm')).toBeInTheDocument();

        expect(screen.getByTestId('result-accuracy')).toHaveTextContent('100.0%');

        expect(screen.getByTestId('result-consistency')).toBeInTheDocument();

        expect(screen.getByTestId('result-duration')).toBeInTheDocument();

        expect(screen.getByTestId('result-errors')).toHaveTextContent('0');
    });

    it('restarts with a clean session and allows another test to complete', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        const incorrectAttempt = `x${LOCAL_TYPING_CONTENT.text.slice(1)}`;

        await typeAttempt(user, incorrectAttempt);

        expect(screen.getByTestId('typing-results')).toBeInTheDocument();

        expect(screen.getByTestId('result-errors')).toHaveTextContent('1');

        expect(screen.getByTestId('result-accuracy')).not.toHaveTextContent('100.0%');

        await user.click(
            screen.getByRole('button', {
                name: 'Restart test',
            }),
        );

        expect(screen.queryByTestId('typing-results')).not.toBeInTheDocument();

        expect(screen.getByTestId('typing-surface')).toBeInTheDocument();

        expect(screen.getByTestId('session-status')).toHaveTextContent('idle');

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `0 / ${String(TOTAL_CHARACTERS)}`,
        );

        expect(screen.getByTestId('letter-progress')).toHaveTextContent('0');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'current');
        expect(getCharacter(1)).toHaveAttribute('data-state', 'pending');

        await typeAttempt(user, LOCAL_TYPING_CONTENT.text);

        expect(screen.getByTestId('session-status')).toHaveTextContent('completed');

        expect(screen.getByTestId('typing-results')).toBeInTheDocument();

        expect(screen.getByTestId('result-errors')).toHaveTextContent('0');

        expect(screen.getByTestId('result-accuracy')).toHaveTextContent('100.0%');
    });
});
