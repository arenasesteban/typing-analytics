import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CompleteTypingSessionPipe } from './complete-typing-session.pipe.js';
import { TypingSessionsController } from './typing-sessions.controller.js';
import { TypingSessionsService } from './typing-sessions.service.js';

@Module({
    imports: [AuthModule, PrismaModule],
    controllers: [TypingSessionsController],
    providers: [TypingSessionsService, CompleteTypingSessionPipe],
})
export class TypingSessionsModule {}
