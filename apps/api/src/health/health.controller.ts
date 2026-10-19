import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { HealthService, type ReadinessResult } from './health.service.js';

@Controller('health')
export class HealthController {
    constructor(private readonly health: HealthService) {}

    @Get('live')
    liveness(): { status: 'ok' } {
        return { status: 'ok' };
    }

    @Get('ready')
    async readiness(): Promise<ReadinessResult> {
        const result = await this.health.checkReadiness();

        if (result.status !== 'ready') {
            throw new ServiceUnavailableException(result);
        }

        return result;
    }
}
