import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AnalyticsOverviewQueryPipe } from './analytics-overview-query.pipe.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
    imports: [AuthModule, PrismaModule],
    controllers: [AnalyticsController],
    providers: [AnalyticsService, AnalyticsOverviewQueryPipe],
})
export class AnalyticsModule {}
