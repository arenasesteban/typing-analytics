import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { TypingSessionsService } from './typing-sessions.service.js';
import type { CreatedTypingSessionResponse } from './typing-sessions.types.js';

function isEmptyObject(value: unknown): boolean {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
    );
}

@Controller('typing-sessions')
export class TypingSessionsController {
    constructor(private readonly typingSessionsService: TypingSessionsService) {}

    @Post()
    create(@Body() body: unknown): Promise<CreatedTypingSessionResponse> {
        if (body !== undefined && !isEmptyObject(body)) {
            throw new BadRequestException('Typing session creation does not accept request data');
        }

        return this.typingSessionsService.create();
    }
}
