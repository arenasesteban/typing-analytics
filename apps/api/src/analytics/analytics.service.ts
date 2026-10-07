import { Injectable, InternalServerErrorException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { DAY_IN_MS, type AnalyticsRange } from './analytics.constants.js';
import type {
    AnalyticsOverviewQuery,
    AnalyticsOverviewResponse,
    AnalyticsOverviewTrendPointResponse,
} from './analytics.types.js';

interface PersistedAnalyticsSession {
    readonly wpm: number | null;
    readonly accuracy: number | null;
    readonly consistency: number | null;
    readonly completedAt: Date | null;
}

interface ValidatedAnalyticsSession {
    readonly wpm: number;
    readonly accuracy: number;
    readonly consistency: number;
    readonly completedAt: Date;
}

function getRangeStart(range: AnalyticsRange, now: Date): Date | undefined {
    switch (range) {
        case '7d':
            return new Date(now.getTime() - 7 * DAY_IN_MS);
        case '30d':
            return new Date(now.getTime() - 30 * DAY_IN_MS);
        case 'all':
            return undefined;
    }
}

function validateCompletedSession(session: PersistedAnalyticsSession): ValidatedAnalyticsSession {
    if (
        session.wpm === null ||
        session.accuracy === null ||
        session.consistency === null ||
        session.completedAt === null
    ) {
        throw new InternalServerErrorException(
            'Completed typing session is missing persisted result data',
        );
    }

    return {
        wpm: session.wpm,
        accuracy: session.accuracy,
        consistency: session.consistency,
        completedAt: session.completedAt,
    };
}

function toTrendPoint(session: ValidatedAnalyticsSession): AnalyticsOverviewTrendPointResponse {
    return {
        completedAt: session.completedAt.toISOString(),
        wpm: session.wpm,
        accuracy: session.accuracy,
    };
}

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) {}

    async overview(
        userId: string,
        query: AnalyticsOverviewQuery,
    ): Promise<AnalyticsOverviewResponse> {
        const rangeStart = getRangeStart(query.range, new Date());

        const sessions = await this.prisma.typingSession.findMany({
            where: {
                userId,
                completedAt:
                    rangeStart === undefined
                        ? {
                              not: null,
                          }
                        : {
                              not: null,
                              gte: rangeStart,
                          },
            },
            orderBy: [
                {
                    completedAt: 'asc',
                },
                {
                    id: 'asc',
                },
            ],
            select: {
                wpm: true,
                accuracy: true,
                consistency: true,
                completedAt: true,
            },
        });

        if (sessions.length === 0) {
            return {
                range: query.range,
                summary: {
                    sessionCount: 0,
                    recentWpm: null,
                    recentAccuracy: null,
                    consistency: null,
                },
                trends: [],
            };
        }

        const completedSessions = sessions.map(validateCompletedSession);

        const recentSession = completedSessions.at(-1);

        if (recentSession === undefined) {
            throw new InternalServerErrorException(
                'Historical analytics could not determine the most recent session',
            );
        }

        const consistency =
            completedSessions.reduce((total, session) => total + session.consistency, 0) /
            completedSessions.length;

        return {
            range: query.range,
            summary: {
                sessionCount: completedSessions.length,
                recentWpm: recentSession.wpm,
                recentAccuracy: recentSession.accuracy,
                consistency,
            },
            trends: completedSessions.map(toTrendPoint),
        };
    }
}
