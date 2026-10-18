import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { SessionBehavioralResult } from '@typing-analytics/typing-core';

import { TemporalPerformanceChart } from './temporal-performance-chart';

const TEMPORAL: SessionBehavioralResult['temporal'] = {
    sampleIntervalMs: 1000,
    points: [
        { elapsedMs: 1000, wpm: 24, rawWpm: 30 },
        { elapsedMs: 1250, wpm: 28, rawWpm: 36 },
    ],
    errorMarkers: [
        {
            sequence: 2,
            elapsedMs: 400,
            position: 1,
            expectedCharacter: 'a',
            enteredCharacter: 'x',
            corrected: true,
            correctionSequence: 3,
            correctionElapsedMs: 550,
        },
        {
            sequence: 4,
            elapsedMs: 800,
            position: 2,
            expectedCharacter: 'b',
            enteredCharacter: 'z',
            corrected: false,
            correctionSequence: null,
            correctionElapsedMs: null,
        },
    ],
};

describe('TemporalPerformanceChart', () => {
    it('renders exactly two speed curves', () => {
        render(<TemporalPerformanceChart temporal={TEMPORAL} />);

        expect(screen.getByTestId('chart-wpm-curve')).toBeInTheDocument();
        expect(screen.getByTestId('chart-raw-wpm-curve')).toBeInTheDocument();

        expect(
            screen.getByTestId('temporal-performance-chart').querySelectorAll('polyline'),
        ).toHaveLength(2);

        expect(screen.getByTestId('chart-sample-count')).toHaveTextContent('2 temporal samples');
    });

    it('includes the exact fractional final sample', () => {
        render(<TemporalPerformanceChart temporal={TEMPORAL} />);

        expect(screen.getByTestId('chart-wpm-curve').getAttribute('points')).toBeTruthy();

        expect(screen.getByTestId('temporal-performance-chart')).toHaveTextContent('1.25 s');
    });

    it('allows selecting corrected error markers', async () => {
        const user = userEvent.setup();

        render(<TemporalPerformanceChart temporal={TEMPORAL} />);

        await user.click(screen.getByTestId('error-marker-2'));

        const detail = screen.getByTestId('selected-error-detail');

        expect(detail).toHaveTextContent('Expected');
        expect(detail).toHaveTextContent('Entered');
        expect(detail).toHaveTextContent('0.40 s');
        expect(detail).toHaveTextContent('Removed by Backspace at 0.55 s');

        expect(screen.getByTestId('error-marker-2')).toHaveAttribute('aria-pressed', 'true');
    });

    it('supports keyboard selection and uncorrected errors', async () => {
        const user = userEvent.setup();

        render(<TemporalPerformanceChart temporal={TEMPORAL} />);

        const marker = screen.getByTestId('error-marker-4');

        marker.focus();
        await user.keyboard('{Enter}');

        expect(marker).toHaveAttribute('aria-pressed', 'true');

        expect(screen.getByTestId('selected-error-detail')).toHaveTextContent('Not corrected');
    });

    it('displays an empty error state without inventing markers', () => {
        render(
            <TemporalPerformanceChart
                temporal={{
                    ...TEMPORAL,
                    errorMarkers: [],
                }}
            />,
        );

        expect(screen.getByTestId('chart-no-errors')).toBeInTheDocument();

        expect(screen.queryByTestId('selected-error-detail')).not.toBeInTheDocument();
    });

    it('renders a single sample for a short test', () => {
        render(
            <TemporalPerformanceChart
                temporal={{
                    sampleIntervalMs: 1000,
                    points: [{ elapsedMs: 350, wpm: 34, rawWpm: 34 }],
                    errorMarkers: [],
                }}
            />,
        );

        expect(screen.getByTestId('chart-sample-count')).toHaveTextContent('1 temporal samples');

        expect(
            screen.getByTestId('temporal-performance-chart').querySelectorAll('circle'),
        ).toHaveLength(2);
    });
});
