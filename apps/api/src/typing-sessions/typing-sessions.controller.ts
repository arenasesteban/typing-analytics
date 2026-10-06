import {
    BadRequestException,
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    ParseUUIDPipe,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CompleteTypingSessionPipe } from './complete-typing-session.pipe.js';
import { TypingSessionsService } from './typing-sessions.service.js';
import type {
    CompleteTypingSessionRequest,
    CompletedTypingSessionResponse,
    CreatedTypingSessionResponse,
} from './typing-sessions.types.js';

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

    @Post()
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
    complete(
        @Req() request: AuthenticatedRequest,
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body(CompleteTypingSessionPipe)
        completionRequest: CompleteTypingSessionRequest,
    ): Promise<CompletedTypingSessionResponse> {
        return this.typingSessionsService.complete(request.auth.userId, id, completionRequest);
    }
}
