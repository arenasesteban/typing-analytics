import {
    BadRequestException,
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CompleteTypingSessionPipe } from './complete-typing-session.pipe.js';
import { TypingSessionHistoryQueryPipe } from './typing-session-history-query.pipe.js';
import { TypingSessionsService } from './typing-sessions.service.js';
import type {
    CompleteTypingSessionRequest,
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
    TypingSessionHistoryDetailResponse,
    TypingSessionHistoryQuery,
    TypingSessionHistoryResponse,
} from './typing-sessions.types.js';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMITS } from '../security/rate-protection.constants.js';
import { RateProtectionGuard } from '../security/rate-protection.guard.js';

function isEmptyObject(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
    );
}

@Controller('typing-sessions')
@UseGuards(AccessTokenGuard)
export class TypingSessionsController {
    constructor(private readonly typingSessionsService: TypingSessionsService) {}

    @Get()
    history(
        @Req() request: AuthenticatedRequest,
        @Query(TypingSessionHistoryQueryPipe)
        query: TypingSessionHistoryQuery,
    ): Promise<TypingSessionHistoryResponse> {
        return this.typingSessionsService.history(request.auth.userId, query);
    }

    @Get(':id')
    detail(
        @Req() request: AuthenticatedRequest,
        @Param('id', new ParseUUIDPipe()) id: string,
    ): Promise<TypingSessionHistoryDetailResponse> {
        return this.typingSessionsService.historyDetail(request.auth.userId, id);
    }

    @Post()
    @UseGuards(RateProtectionGuard)
    @Throttle({
        default: {
            limit: RATE_LIMITS.sessionCreate,
            ttl: RATE_LIMIT_WINDOW_MS,
        },
    })
    create(
        @Req() request: AuthenticatedRequest,
        @Body() body: unknown,
    ): Promise<CreatedTypingSessionResponse> {
        if (body !== undefined && !isEmptyObject(body)) {
            throw new BadRequestException('Typing session creation does not accept request data');
        }

        return this.typingSessionsService.create(request.auth.userId);
    }

    @Post(':id/complete')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RateProtectionGuard)
    @Throttle({
        default: {
            limit: RATE_LIMITS.sessionComplete,
            ttl: RATE_LIMIT_WINDOW_MS,
        },
    })
    complete(
        @Req() request: AuthenticatedRequest,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(CompleteTypingSessionPipe)
        completionRequest: CompleteTypingSessionRequest,
    ): Promise<CompletedTypingSessionResponse> {
        return this.typingSessionsService.complete(request.auth.userId, id, completionRequest);
    }
}
