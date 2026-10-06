import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../prisma/prisma.module.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './auth.constants.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
    imports: [
        PrismaModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
                signOptions: {
                    algorithm: 'HS256',
                    expiresIn: configService.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS'),
                    issuer: ACCESS_TOKEN_ISSUER,
                    audience: ACCESS_TOKEN_AUDIENCE,
                },
                verifyOptions: {
                    algorithms: ['HS256'],
                    issuer: ACCESS_TOKEN_ISSUER,
                    audience: ACCESS_TOKEN_AUDIENCE,
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, PasswordService, RefreshTokenService, AccessTokenGuard],
    exports: [AccessTokenGuard],
})
export class AuthModule {}
