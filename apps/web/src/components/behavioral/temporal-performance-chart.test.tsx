import { render, screen } from '@testing-library/react';
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
