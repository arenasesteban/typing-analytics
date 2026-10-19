import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RateProtectionGuard extends ThrottlerGuard {
    protected override async getTracker(request: Record<string, unknown>): Promise<string> {
        const auth = request['auth'];

        if (
            typeof auth === 'object' &&
            auth !== null &&
            'userId' in auth &&
            typeof auth.userId === 'string' &&
            auth.userId.length > 0
        ) {
            return `user:${auth.userId}`;
        }

        const ip = await super.getTracker(request);

        return `ip:${ip}`;
    }
}
