import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
    deriveSessionBehavioralResult,
    summarizeCompletedSession,
} from '@typing-analytics/typing-core';

import { MongoService } from '../mongo/mongo.service.js';
import { replayStoredSessionEvents } from '../session-events/session-events.mapper.js';
import type { PersistedCompletedSessionDetail } from './typing-sessions.selects.js';
import type {
    PersistedTypingSessionResultResponse,
    TypingSessionBehavioralResponse,
} from './typing-sessions.types.js';

function sameNumber(left: number, right: number): boolean {
    return Math.abs(left - right) <= 1e-6;
}

@Injectable()
export class TypingSessionsBehavioralService {
    private readonly logger = new Logger(TypingSessionsBehavioralService.name);

    constructor(private readonly mongo: MongoService) {}

    async getSessionBehavioralResult(
        session: PersistedCompletedSessionDetail,
        persistedResult: PersistedTypingSessionResultResponse,
    ): Promise<TypingSessionBehavioralResponse> {
        switch (session.eventDeliveryStatus) {
            case 'UNAVAILABLE':
                return { status: 'unavailable' };
            case 'PENDING':
                return { status: 'pending' };
            case 'READY':
                return this.getReadySessionBehavioralResult(session, persistedResult);
            default: {
                const unexpectedStatus: never = session.eventDeliveryStatus;
                throw new ServiceUnavailableException(
                    `Unsupported event delivery status: ${String(unexpectedStatus)}`,
                );
            }
        }
    }

    private async getReadySessionBehavioralResult(
        session: PersistedCompletedSessionDetail,
        persistedResult: PersistedTypingSessionResultResponse,
    ): Promise<TypingSessionBehavioralResponse> {
        try {
            const document = await this.mongo.findSessionEvents(session.id);

            if (document === null || document._id !== session.id) {
                throw new Error('Confirmed session event document is missing');
            }

            const reconstructedSession = replayStoredSessionEvents(
                session.typingText.text,
                document,
            );
            const summary = summarizeCompletedSession(reconstructedSession);

            const summaryMatches =
                summary.durationMs === persistedResult.durationMs &&
                summary.totalInputs === persistedResult.totalInputs &&
                summary.correctInputs === persistedResult.correctInputs &&
                summary.incorrectInputs === persistedResult.incorrectInputs &&
                sameNumber(summary.wpm, persistedResult.wpm) &&
                sameNumber(summary.rawWpm, persistedResult.rawWpm) &&
                sameNumber(summary.accuracy, persistedResult.accuracy) &&
                sameNumber(summary.consistency, persistedResult.consistency);

            if (!summaryMatches) {
                throw new Error('Event sequence does not match the persisted session summary');
            }

            const result = deriveSessionBehavioralResult(reconstructedSession);

            return {
                status: 'ready',
                ...result,
            };
        } catch (error) {
            this.logger.warn(
                `Behavioral results unavailable for session ${session.id}: ${
                    error instanceof Error ? error.name : 'UnknownError'
                }`,
            );

            throw new ServiceUnavailableException('Behavioral results are temporarily unavailable');
        }
    }
}
