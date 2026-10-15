export interface TemporalPerformancePoint {
    readonly elapsedMs: number;
    readonly wpm: number;
    readonly rawWpm: number;
}

export interface TypingErrorMarker {
    readonly sequence: number;
    readonly elapsedMs: number;
    readonly position: number;
    readonly expectedCharacter: string;
    readonly enteredCharacter: string;
    readonly corrected: boolean;
    readonly correctionSequence: number | null;
    readonly correctionElapsedMs: number | null;
}

export interface SessionBehavioralResult {
    readonly temporal: {
        readonly sampleIntervalMs: 1000;
        readonly points: readonly TemporalPerformancePoint[];
        readonly errorMarkers: readonly TypingErrorMarker[];
    };
}
