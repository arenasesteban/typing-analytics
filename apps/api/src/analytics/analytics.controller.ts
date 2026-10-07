import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AnalyticsOverviewQueryPipe } from './analytics-overview-query.pipe.js';
import { AnalyticsService } from './analytics.service.js';
import type { AnalyticsOverviewQuery, AnalyticsOverviewResponse } from './analytics.types.js';

@Controller('analytics')
@UseGuards(AccessTokenGuard)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) {}

    @Get('overview')
    overview(
        @Req() request: AuthenticatedRequest,
        @Query(AnalyticsOverviewQueryPipe) query: AnalyticsOverviewQuery,
    ): Promise<AnalyticsOverviewResponse> {
        return this.analyticsService.overview(request.auth.userId, query);
    }
}
