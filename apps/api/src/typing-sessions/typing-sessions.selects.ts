import type { Prisma } from '../generated/prisma/client.js';

export const completedSessionSelect = {
    id: true,
    durationMs: true,
    wpm: true,
    rawWpm: true,
    accuracy: true,
    consistency: true,
    totalInputs: true,
    correctInputs: true,
    incorrectInputs: true,
    startedAt: true,
    completedAt: true,
} as const satisfies Prisma.TypingSessionSelect;

export const completedSessionDetailSelect = {
    ...completedSessionSelect,
    eventDeliveryStatus: true,
    typingText: {
        select: {
            id: true,
            text: true,
        },
    },
} as const satisfies Prisma.TypingSessionSelect;

export type PersistedCompletedSession = Prisma.TypingSessionGetPayload<{
    select: typeof completedSessionSelect;
}>;

export type PersistedCompletedSessionDetail = Prisma.TypingSessionGetPayload<{
    select: typeof completedSessionDetailSelect;
}>;
