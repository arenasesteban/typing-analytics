export interface TemporalPerformancePoint {
    readonly elapsedMs: number;
    readonly wpm: number;
    readonly rawWpm: number;
}

export interface SessionBehavioralResult {
    readonly temporal: {
        readonly sampleIntervalMs: 1000;
        readonly points: readonly TemporalPerformancePoint[];
    };
}
