import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_TYPING_TEXT } from './typing-sessions.constants.js';
import type { CreatedTypingSessionResponse } from './typing-sessions.types.js';

@Injectable()
export class TypingSessionsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(): Promise<CreatedTypingSessionResponse> {
        const typingText = await this.prisma.typingText.upsert({
            where: {
                text: DEFAULT_TYPING_TEXT,
            },
            update: {},
            create: {
                text: DEFAULT_TYPING_TEXT,
            },
            select: {
                id: true,
                text: true,
            },
        });

        return this.prisma.typingSession.create({
            data: {
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
}
