import { randomUUID } from 'node:crypto';
import {
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '../generated/prisma/client.js';
import { MongoService } from '../mongo/mongo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SessionEventDocument } from './session-events.types.js';
import { isSessionEventDocument } from './session-events.validator.js';

const POLL_INTERVAL_MS = 5_000;
const LEASE_DURATION_MS = 60_000;
const MAX_BATCH_SIZE = 25;

interface ClaimedDelivery {
    readonly sessionId: string;
    readonly payload: Prisma.JsonValue;
    readonly attempts: number;
    readonly leaseToken: string;
}

@Injectable()
export class EventDeliveryService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(EventDeliveryService.name);

    private timer: NodeJS.Timeout | undefined;
    private processing = false;

    constructor(
        private readonly prisma: PrismaService,
        private readonly mongo: MongoService,
        private readonly config: ConfigService,
    ) {}

    onApplicationBootstrap(): void {
        const enabled = this.config.get<boolean>('EVENT_DELIVERY_AUTOSTART') ?? true;

        if (!enabled) {
            return;
        }

        this.timer = setInterval(() => {
            void this.processPending().catch((error: unknown) => {
                this.logWorkerError(error);
            });
        }, POLL_INTERVAL_MS);

        this.timer.unref();

        void this.processPending().catch((error: unknown) => {
            this.logWorkerError(error);
        });
    }

    onModuleDestroy(): void {
        if (this.timer !== undefined) {
            clearInterval(this.timer);
        }
    }

    async processPending(): Promise<void> {
        if (this.processing) {
            return;
        }

        this.processing = true;

        try {
            for (let index = 0; index < MAX_BATCH_SIZE; index += 1) {
                const delivery = await this.claimNext();

                if (delivery === null) {
                    break;
                }

                try {
                    const document = this.parseDocument(delivery);

                    await this.mongo.writeSessionEvents(document);
                    await this.confirmDelivery(delivery);
                } catch (error) {
                    await this.deferDelivery(delivery);

                    this.logger.warn(
                        `Event delivery deferred for session ${delivery.sessionId}: ${
                            error instanceof Error ? error.name : 'UnknownError'
                        }`,
                    );
                }
            }
        } finally {
            this.processing = false;
        }
    }

    private async claimNext(): Promise<ClaimedDelivery | null> {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const now = new Date();

            const candidate = await this.prisma.sessionEventOutbox.findFirst({
                where: {
                    nextAttemptAt: {
                        lte: now,
                    },
                    OR: [{ leasedUntil: null }, { leasedUntil: { lte: now } }],
                },
                orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
                select: {
                    sessionId: true,
                    payload: true,
                    attempts: true,
                },
            });

            if (candidate === null) {
                return null;
            }

            const token = randomUUID();

            const claim = await this.prisma.sessionEventOutbox.updateMany({
                where: {
                    sessionId: candidate.sessionId,
                    nextAttemptAt: {
                        lte: now,
                    },
                    OR: [{ leasedUntil: null }, { leasedUntil: { lte: now } }],
                },
                data: {
                    leaseToken: token,
                    leasedUntil: new Date(now.getTime() + LEASE_DURATION_MS),
                    attempts: {
                        increment: 1,
                    },
                },
            });

            if (claim.count === 1) {
                return {
                    sessionId: candidate.sessionId,
                    payload: candidate.payload,
                    attempts: candidate.attempts + 1,
                    leaseToken: token,
                };
            }
        }

        return null;
    }

    private parseDocument(delivery: ClaimedDelivery): SessionEventDocument {
        if (
            !isSessionEventDocument(delivery.payload) ||
            delivery.payload._id !== delivery.sessionId
        ) {
            throw new Error('Outbox contains an invalid session event document');
        }

        return delivery.payload;
    }

    private async confirmDelivery(delivery: ClaimedDelivery): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const removed = await tx.sessionEventOutbox.deleteMany({
                where: {
                    sessionId: delivery.sessionId,
                    leaseToken: delivery.leaseToken,
                },
            });

            if (removed.count !== 1) {
                return;
            }

            await tx.typingSession.update({
                where: {
                    id: delivery.sessionId,
                },
                data: {
                    eventDeliveryStatus: 'READY',
                },
            });
        });
    }

    private async deferDelivery(delivery: ClaimedDelivery): Promise<void> {
        const retryDelayMs = Math.min(300_000, 1_000 * 2 ** Math.min(delivery.attempts - 1, 8));

        await this.prisma.sessionEventOutbox.updateMany({
            where: {
                sessionId: delivery.sessionId,
                leaseToken: delivery.leaseToken,
            },
            data: {
                leasedUntil: null,
                leaseToken: null,
                nextAttemptAt: new Date(Date.now() + retryDelayMs),
            },
        });
    }

    private logWorkerError(error: unknown): void {
        this.logger.error(
            `Event delivery worker failed: ${error instanceof Error ? error.name : 'UnknownError'}`,
        );
    }
}
