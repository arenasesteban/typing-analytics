import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    applyTypingInput,
    createTypingSession,
    summarizeCompletedSession,
    type TypingInput,
    type TypingSessionState,
} from '@typing-analytics/typing-core';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_TYPING_TEXT } from './typing-sessions.constants.js';
import type {
    CompleteTypingSessionRequest,
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
} from './typing-sessions.types.js';

@Injectable()
export class TypingSessionsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(): Promise<CreatedTypingSessionResponse> {
        const typingText = await this.prisma.typingText.upsert({
            where: {
                text: DEFAULT_TYPING_TEXT,
            },
            update: {},
            create: {
                text: DEFAULT_TYPING_TEXT,
            },
            select: {
                id: true,
                text: true,
            },
        });

        return this.prisma.typingSession.create({
            data: {
                typingTextId: typingText.id,
            },
            select: {
                id: true,
                typingText: {
                    select: {
                        id: true,
                        text: true,
                    },
                },
            },
        });
    }

    async complete(
        id: string,
        request: CompleteTypingSessionRequest,
    ): Promise<CompletedTypingSessionResponse> {
        const persistedSession = await this.prisma.typingSession.findUnique({
            where: {
                id,
            },
            select: {
                id: true,
                completedAt: true,
                typingText: {
                    select: {
                        id: true,
                        text: true,
                    },
                },
            },
        });

        if (persistedSession === null) {
            throw new NotFoundException('Typing session not found');
        }

        if (persistedSession.completedAt !== null) {
            throw new ConflictException('Typing session has already been completed');
        }

        const replayedSession = this.replayInputs(persistedSession.typingText.text, request.inputs);

        const summary = summarizeCompletedSession(replayedSession);

        const completedAt = new Date();
        const startedAt = new Date(completedAt.getTime() - summary.durationMs);

        if (Number.isNaN(startedAt.getTime())) {
            throw new BadRequestException(
                'Typing session duration cannot be represented as a persisted timestamp',
            );
        }

        const completion = await this.prisma.typingSession.updateMany({
            where: {
                id,
                completedAt: null,
            },
            data: {
                durationMs: summary.durationMs,
                wpm: summary.wpm,
                rawWpm: summary.rawWpm,
                accuracy: summary.accuracy,
                consistency: summary.consistency,
                totalInputs: summary.totalInputs,
                correctInputs: summary.correctInputs,
                incorrectInputs: summary.incorrectInputs,
                startedAt,
                completedAt,
            },
        });

        if (completion.count !== 1) {
            throw new ConflictException('Typing session has already been completed');
        }

        return {
            id: persistedSession.id,
            typingText: persistedSession.typingText,
            durationMs: summary.durationMs,
            wpm: summary.wpm,
            rawWpm: summary.rawWpm,
            accuracy: summary.accuracy,
            consistency: summary.consistency,
            totalInputs: summary.totalInputs,
            correctInputs: summary.correctInputs,
            incorrectInputs: summary.incorrectInputs,
            startedAt: startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
        };
    }

    private replayInputs(targetText: string, inputs: readonly TypingInput[]): TypingSessionState {
        let session = createTypingSession(targetText);

        for (const input of inputs) {
            let nextSession: TypingSessionState;

            try {
                nextSession = applyTypingInput(session, input);
            } catch (error) {
                if (error instanceof RangeError) {
                    throw new BadRequestException(error.message);
                }

                throw error;
            }

            if (nextSession === session) {
                throw new BadRequestException(
                    'Typing input sequence contains an invalid transition',
                );
            }

            session = nextSession;
        }

        if (session.status !== 'completed') {
            throw new BadRequestException(
                'Typing input sequence does not complete the target text',
            );
        }

        return session;
    }
}
