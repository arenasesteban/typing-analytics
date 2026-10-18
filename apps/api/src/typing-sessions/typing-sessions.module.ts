import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { MongoModule } from '../mongo/mongo.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';

import { CompleteTypingSessionPipe } from './complete-typing-session.pipe.js';
import { TypingSessionHistoryQueryPipe } from './typing-session-history-query.pipe.js';
import { TypingSessionsBehavioralService } from './typing-sessions-behavioral.service.js';
import { TypingSessionsController } from './typing-sessions.controller.js';
import { TypingSessionsService } from './typing-sessions.service.js';

@Module({
    imports: [AuthModule, PrismaModule, MongoModule],
    controllers: [TypingSessionsController],
    providers: [
        TypingSessionsService,
        TypingSessionsBehavioralService,
        CompleteTypingSessionPipe,
        TypingSessionHistoryQueryPipe,
    ],
})
export class TypingSessionsModule {}
