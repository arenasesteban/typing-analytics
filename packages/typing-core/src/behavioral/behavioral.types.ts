export interface BehavioralOptions {
    readonly windowMs?: number;
    readonly minimumSample?: number;
    readonly errorRateThresholdPct?: number;
}

export interface TemporalPerformancePoint {
    readonly elapsedMs: number;
    readonly windowDurationMs: number;
    readonly cumulativeWpm: number;
    readonly cumulativeRawWpm: number;
    readonly windowWpm: number;
    readonly windowRawWpm: number;
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

export interface CharacterStatistics {
    readonly expectedCharacter: string;
    readonly sampleCount: number;
    readonly correctInputs: number;
    readonly incorrectInputs: number;
    readonly errorRate: number;
    readonly accuracy: number;
    readonly sufficientSample: boolean;
    readonly problematic: boolean | null;
}

export interface SessionBehavioralResult {
    readonly temporal: {
        readonly windowMs: number;
        readonly points: readonly TemporalPerformancePoint[];
        readonly errorMarkers: readonly TypingErrorMarker[];
    };
    readonly characters: readonly CharacterStatistics[];
    readonly characterPolicy: {
        readonly minimumSample: number;
        readonly errorRateThresholdPct: number;
    };
}
