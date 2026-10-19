import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnvironment } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SessionEventsModule } from './session-events/session-events.module.js';
import { TypingSessionsModule } from './typing-sessions/typing-sessions.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnvironment,
        }),
        PrismaModule,
        AuthModule,
        TypingSessionsModule,
        AnalyticsModule,
        SessionEventsModule,
        HealthModule,
    ],
})
export class AppModule {}
