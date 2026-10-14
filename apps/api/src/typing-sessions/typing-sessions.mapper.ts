import { InternalServerErrorException } from '@nestjs/common';
import type { PersistedCompletedSession } from './typing-sessions.selects.js';
import type { TypingSessionHistoryItemResponse } from './typing-sessions.types.js';

export function toHistoryItem(
    session: PersistedCompletedSession,
): TypingSessionHistoryItemResponse {
    const {
        id,
        durationMs,
        wpm,
        rawWpm,
        accuracy,
        consistency,
        totalInputs,
        correctInputs,
        incorrectInputs,
        startedAt,
        completedAt,
    } = session;

    if (
        durationMs === null ||
        wpm === null ||
        rawWpm === null ||
        accuracy === null ||
        consistency === null ||
        totalInputs === null ||
        correctInputs === null ||
        incorrectInputs === null ||
        startedAt === null ||
        completedAt === null
    ) {
        throw new InternalServerErrorException(
            'Completed typing session is missing persisted result data',
        );
    }

    return {
        id,
        durationMs,
        wpm,
        rawWpm,
        accuracy,
        consistency,
        totalInputs,
        correctInputs,
        incorrectInputs,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
    };
}
