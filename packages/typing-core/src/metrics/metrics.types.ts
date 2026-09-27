export interface CompletedSessionSummary {
    readonly durationMs: number;
    readonly rawWpm: number;
    readonly wpm: number;
    readonly accuracy: number;
    readonly consistency: number;
    readonly totalInputs: number;
    readonly correctInputs: number;
    readonly incorrectInputs: number;
    readonly startedAtMs: number;
    readonly completedAtMs: number;
    readonly latenciesMs: readonly number[];
}
