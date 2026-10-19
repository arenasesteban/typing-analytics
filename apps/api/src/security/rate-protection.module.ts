import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { RATE_LIMIT_WINDOW_MS } from './rate-protection.constants.js';
import { RateProtectionGuard } from './rate-protection.guard.js';

@Module({
    imports: [
        ThrottlerModule.forRoot({
            throttlers: [
                {
                    ttl: RATE_LIMIT_WINDOW_MS,
                    limit: 30,
                },
            ],
            errorMessage: 'Too many requests',
        }),
    ],
    providers: [RateProtectionGuard],
    exports: [RateProtectionGuard],
})
export class RateProtectionModule {}
