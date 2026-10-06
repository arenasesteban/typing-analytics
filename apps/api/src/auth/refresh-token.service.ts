import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';

import { MILLISECONDS_PER_DAY } from './auth.constants.js';

interface IssuedRefreshToken {
    token: string;
    tokenHash: string;
    expiresAt: Date;
}

@Injectable()
export class RefreshTokenService {
    private readonly lifetimeMilliseconds: number;

    constructor(configService: ConfigService) {
        const lifetimeDays = configService.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS');

        this.lifetimeMilliseconds = lifetimeDays * MILLISECONDS_PER_DAY;
    }

    issue(): IssuedRefreshToken {
        const token = randomBytes(32).toString('base64url');

        return {
            token,
            tokenHash: this.hash(token),
            expiresAt: new Date(Date.now() + this.lifetimeMilliseconds),
        };
    }

    hash(token: string): string {
        return createHash('sha256').update(token, 'utf8').digest('hex');
    }
}
