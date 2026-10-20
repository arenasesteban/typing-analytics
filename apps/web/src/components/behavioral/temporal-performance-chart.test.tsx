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

    it('exposes numerical equivalents for the temporal chart', async () => {
        const user = userEvent.setup();

        render(<TemporalPerformanceChart temporal={TEMPORAL} />);

        expect(
            screen.getByRole('heading', {
                name: 'Temporal performance',
                level: 2,
            }),
        ).toBeInTheDocument();

        const toggle = screen.getByText('View temporal speed values');

        expect(toggle).toBeInTheDocument();

        await user.click(toggle);

        const table = screen.getByRole('table', {
            name: 'Temporal WPM and Raw WPM measurements',
        });

        expect(table).toBeVisible();
        expect(table.querySelectorAll('tbody tr')).toHaveLength(TEMPORAL.points.length);
        expect(table).toHaveTextContent('1.00 s');
        expect(table).toHaveTextContent('1.25 s');
        expect(table).toHaveTextContent('24');
        expect(table).toHaveTextContent('28');
        expect(table).toHaveTextContent('30');
        expect(table).toHaveTextContent('36');

        const svg = screen.getByTestId('chart-wpm-curve').closest('svg');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('focusable', 'false');
    });

    it('includes the exact fractional final sample', () => {
        render(<TemporalPerformanceChart temporal={TEMPORAL} />);

        expect(screen.getByTestId('chart-wpm-curve').getAttribute('points')).toBeTruthy();

        expect(screen.getByTestId('temporal-performance-chart')).toHaveTextContent('1.25 s');
    });

    it('renders a single sample for a short test', () => {
        render(
            <TemporalPerformanceChart
                temporal={{
                    sampleIntervalMs: 1000,
                    points: [
                        {
                            elapsedMs: 350,
                            wpm: 34,
                            rawWpm: 34,
                        },
                    ],
                }}
            />,
        );

        const chart = screen.getByTestId('temporal-performance-chart');

        expect(chart).toBeInTheDocument();

        expect(screen.getByTestId('chart-sample-count')).toHaveTextContent('1 temporal samples');

        expect(screen.getByTestId('chart-wpm-curve')).toBeInTheDocument();
        expect(screen.getByTestId('chart-raw-wpm-curve')).toBeInTheDocument();

        expect(chart.querySelectorAll('polyline')).toHaveLength(2);
        expect(chart.querySelectorAll('circle')).toHaveLength(0);
    });
});
