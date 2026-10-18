import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    PayloadTooLargeException,
} from '@nestjs/common';
import {
    applyTypingInput,
    createTypingSession,
    generateTypingText,
    summarizeCompletedSession,
    type TypingInput,
    type TypingSessionState,
} from '@typing-analytics/typing-core';

import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
    buildSessionEventDocument,
    SessionEventDocumentTooLargeError,
} from '../session-events/session-events.mapper.js';
import { TypingSessionsBehavioralService } from './typing-sessions-behavioral.service.js';
import { toHistoryItem } from './typing-sessions.mapper.js';
import { completedSessionDetailSelect, completedSessionSelect } from './typing-sessions.selects.js';
import type {
    CompleteTypingSessionRequest,
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
    TypingSessionHistoryDetailResponse,
    TypingSessionHistoryQuery,
    TypingSessionHistoryResponse,
} from './typing-sessions.types.js';

@Injectable()
export class TypingSessionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly behavioral: TypingSessionsBehavioralService,
    ) {}

    async history(
        userId: string,
        query: TypingSessionHistoryQuery,
    ): Promise<TypingSessionHistoryResponse> {
        const skip = (query.page - 1) * query.pageSize;

        const [totalItems, sessions] = await this.prisma.$transaction([
            this.prisma.typingSession.count({
                where: {
                    userId,
                    completedAt: {
                        not: null,
                    },
                },
            }),
            this.prisma.typingSession.findMany({
                where: {
                    userId,
                    completedAt: {
                        not: null,
                    },
                },
                orderBy: [
                    {
                        completedAt: 'desc',
                    },
                    {
                        id: 'desc',
                    },
                ],
                skip,
                take: query.pageSize,
                select: completedSessionSelect,
            }),
        ]);

        return {
            items: sessions.map(toHistoryItem),
            pagination: {
                page: query.page,
                pageSize: query.pageSize,
                totalItems,
                totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize),
            },
        };
    }

    async historyDetail(userId: string, id: string): Promise<TypingSessionHistoryDetailResponse> {
        const session = await this.prisma.typingSession.findFirst({
            where: {
                id,
                userId,
                completedAt: {
                    not: null,
                },
            },
            select: completedSessionDetailSelect,
        });

        if (session === null) {
            throw new NotFoundException('Typing session not found');
        }

        const persistedResult = toHistoryItem(session);
        const behavioral = await this.behavioral.getSessionBehavioralResult(
            session,
            persistedResult,
        );

        return {
            ...persistedResult,
            typingText: session.typingText,
            behavioral,
        };
    }

    async create(userId: string): Promise<CreatedTypingSessionResponse> {
        const generatedText = generateTypingText();

        const typingText = await this.prisma.typingText.upsert({
            where: {
                text: generatedText,
            },
            update: {},
            create: {
                text: generatedText,
            },
            select: {
                id: true,
                text: true,
            },
        });

        return this.prisma.typingSession.create({
            data: {
                userId,
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
        userId: string,
        id: string,
        request: CompleteTypingSessionRequest,
    ): Promise<CompletedTypingSessionResponse> {
        const persistedSession = await this.prisma.typingSession.findFirst({
            where: {
                id,
                userId,
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

        let eventDocument: ReturnType<typeof buildSessionEventDocument>;

        try {
            eventDocument = buildSessionEventDocument(id, replayedSession);
        } catch (error) {
            if (error instanceof SessionEventDocumentTooLargeError) {
                throw new PayloadTooLargeException(error.message);
            }

            throw error;
        }

        await this.prisma.$transaction(async (tx) => {
            const completion = await tx.typingSession.updateMany({
                where: {
                    id,
                    userId,
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
                    eventDeliveryStatus: 'PENDING',
                },
            });

            if (completion.count !== 1) {
                throw new ConflictException('Typing session has already been completed');
            }

            await tx.sessionEventOutbox.create({
                data: {
                    sessionId: id,
                    payload: eventDocument as unknown as Prisma.InputJsonValue,
                },
            });
        });

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
