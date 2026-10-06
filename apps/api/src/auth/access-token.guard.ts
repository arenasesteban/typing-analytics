import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { AccessTokenPayload, AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const authorization = request.headers.authorization;

        if (authorization === undefined || !authorization.startsWith('Bearer ')) {
            throw new UnauthorizedException('Authentication required');
        }

        const token = authorization.slice('Bearer '.length).trim();

        if (token.length === 0 || token.includes(' ')) {
            throw new UnauthorizedException('Authentication required');
        }

        try {
            const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);

            if (
                typeof payload.sub !== 'string' ||
                payload.sub.length === 0 ||
                typeof payload.email !== 'string' ||
                payload.email.length === 0
            ) {
                throw new Error('Invalid access token payload');
            }

            request.auth = {
                userId: payload.sub,
                email: payload.email,
            };

            return true;
        } catch {
            throw new UnauthorizedException('Authentication required');
        }
    }
}
