import { Injectable } from '@nestjs/common';

import { MongoService } from '../mongo/mongo.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEPENDENCY_CHECK_TIMEOUT_MS = 1_500;

type DependencyStatus = 'up' | 'down';

export interface ReadinessResult {
    status: 'ready' | 'degraded' | 'unavailable';
    dependencies: {
        postgresql: DependencyStatus;
        mongodb: DependencyStatus;
    };
}

@Injectable()
export class HealthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mongo: MongoService,
    ) {}

    async checkReadiness(): Promise<ReadinessResult> {
        const [postgresql, mongodb] = await Promise.all([
            this.checkDependency(() => this.prisma.$queryRaw`SELECT 1`),
            this.checkDependency(() => this.mongo.ping()),
        ]);

        const status: ReadinessResult['status'] =
            postgresql === 'down' ? 'unavailable' : mongodb === 'down' ? 'degraded' : 'ready';

        return {
            status,
            dependencies: {
                postgresql,
                mongodb,
            },
        };
    }

    private async checkDependency(operation: () => Promise<unknown>): Promise<DependencyStatus> {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        try {
            await Promise.race([
                Promise.resolve().then(operation),
                new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(() => {
                        reject(new Error('Dependency health check timed out'));
                    }, DEPENDENCY_CHECK_TIMEOUT_MS);
                }),
            ]);

            return 'up';
        } catch {
            return 'down';
        } finally {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
        }
    }
}
