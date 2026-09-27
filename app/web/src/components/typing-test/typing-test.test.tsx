import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { LOCAL_TYPING_CONTENT } from '@/content/typing-content';

import { TypingTest } from './typing-test';

const TOTAL_CHARACTERS = Array.from(LOCAL_TYPING_CONTENT.text).length;

function getCharacter(position: number) {
    return screen.getByTestId(`character-${String(position)}`);
}

describe('TypingTest', () => {
    it('renders the bundled local text before typing begins', () => {
        render(<TypingTest />);

        expect(screen.getByTestId('typing-text')).toHaveTextContent(LOCAL_TYPING_CONTENT.text);

        expect(screen.getByTestId('session-status')).toHaveTextContent('ready');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'current');

        expect(getCharacter(1)).toHaveAttribute('data-state', 'pending');
    });

    it('forwards correct keyboard input to the domain and advances the current position', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        const surface = screen.getByTestId('typing-surface');

        await user.click(surface);

        const firstCharacter = LOCAL_TYPING_CONTENT.text.slice(0, 1);

        await user.keyboard(firstCharacter);

        expect(getCharacter(0)).toHaveAttribute('data-state', 'correct');

        expect(getCharacter(0)).toHaveClass('text-zinc-100');

        expect(getCharacter(1)).toHaveAttribute('data-state', 'current');

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `1 / ${String(TOTAL_CHARACTERS)}`,
        );

        expect(screen.getByTestId('session-status')).toHaveTextContent('typing');
    });

    it('renders incorrect input using the incorrect visual state', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        await user.click(screen.getByTestId('typing-surface'));

        await user.keyboard('x');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'incorrect');

        expect(getCharacter(0)).toHaveClass('text-red-400');

        expect(getCharacter(1)).toHaveAttribute('data-state', 'current');
    });

    it('forwards Backspace to the domain and restores the current position', async () => {
        const user = userEvent.setup();

        render(<TypingTest />);

        await user.click(screen.getByTestId('typing-surface'));

        await user.keyboard('x');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'incorrect');

        await user.keyboard('{Backspace}');

        expect(getCharacter(0)).toHaveAttribute('data-state', 'current');

        expect(screen.getByTestId('current-position')).toHaveTextContent(
            `0 / ${String(TOTAL_CHARACTERS)}`,
        );
    });
});
