import {
    BadRequestException,
    ConflictException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import {
    applyTypingInput,
    createTypingSession,
    generateTypingText,
    summarizeCompletedSession,
    type TypingInput,
    type TypingSessionState,
} from '@typing-analytics/typing-core';

import { PrismaService } from '../prisma/prisma.service.js';
import type {
    CompleteTypingSessionRequest,
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
    TypingSessionHistoryDetailResponse,
    TypingSessionHistoryItemResponse,
    TypingSessionHistoryQuery,
    TypingSessionHistoryResponse,
} from './typing-sessions.types.js';

interface PersistedCompletedSession {
    readonly id: string;
    readonly durationMs: number | null;
    readonly wpm: number | null;
    readonly rawWpm: number | null;
    readonly accuracy: number | null;
    readonly consistency: number | null;
    readonly totalInputs: number | null;
    readonly correctInputs: number | null;
    readonly incorrectInputs: number | null;
    readonly startedAt: Date | null;
    readonly completedAt: Date | null;
}

interface PersistedCompletedSessionDetail extends PersistedCompletedSession {
    readonly typingText: {
        readonly id: string;
        readonly text: string;
    };
}

function toHistoryItem(session: PersistedCompletedSession): TypingSessionHistoryItemResponse {
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

@Injectable()
export class TypingSessionsService {
    constructor(private readonly prisma: PrismaService) {}

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
                select: {
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
                },
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
            select: {
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
                typingText: {
                    select: {
                        id: true,
                        text: true,
                    },
                },
            },
        });

        if (session === null) {
            throw new NotFoundException('Typing session not found');
        }

        const persistedSession: PersistedCompletedSessionDetail = session;

        return {
            ...toHistoryItem(persistedSession),
            typingText: persistedSession.typingText,
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

        const completion = await this.prisma.typingSession.updateMany({
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
