export interface CreatedTypingSessionResponse {
    readonly id: string;
    readonly typingText: {
        readonly id: string;
        readonly text: string;
    };
}
