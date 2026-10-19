import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Req,
    Res,
    UseGuards,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { AccessTokenGuard } from './access-token.guard.js';
import {
    clearRefreshTokenCookie,
    readRefreshTokenCookie,
    setRefreshTokenCookie,
} from './auth.cookies.js';
import { AuthService } from './auth.service.js';
import type { AuthSessionResponse, AuthUserResponse, AuthenticatedRequest } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMITS } from '../security/rate-protection.constants.js';
import { RateProtectionGuard } from '../security/rate-protection.guard.js';

@Controller('auth')
@UsePipes(
    new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
    }),
)
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) {}

    @Post('register')
    @UseGuards(RateProtectionGuard)
    @Throttle({
        default: {
            limit: RATE_LIMITS.register,
            ttl: RATE_LIMIT_WINDOW_MS,
        },
    })
    async register(
        @Body() request: RegisterDto,
        @Res({ passthrough: true }) response: Response,
    ): Promise<AuthSessionResponse> {
        const issuedSession = await this.authService.register(request);

        setRefreshTokenCookie(response, issuedSession.refreshToken, this.configService);

        return issuedSession.response;
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RateProtectionGuard)
    @Throttle({
        default: {
            limit: RATE_LIMITS.login,
            ttl: RATE_LIMIT_WINDOW_MS,
        },
    })
    async login(
        @Body() request: LoginDto,
        @Res({ passthrough: true }) response: Response,
    ): Promise<AuthSessionResponse> {
        const issuedSession = await this.authService.login(request);

        setRefreshTokenCookie(response, issuedSession.refreshToken, this.configService);

        return issuedSession.response;
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @UseGuards(RateProtectionGuard)
    @Throttle({
        default: {
            limit: RATE_LIMITS.refresh,
            ttl: RATE_LIMIT_WINDOW_MS,
        },
    })
    async refresh(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<AuthSessionResponse> {
        const refreshToken = readRefreshTokenCookie(request);
        const issuedSession = await this.authService.refresh(refreshToken);

        setRefreshTokenCookie(response, issuedSession.refreshToken, this.configService);

        return issuedSession.response;
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(RateProtectionGuard)
    @Throttle({
        default: {
            limit: RATE_LIMITS.logout,
            ttl: RATE_LIMIT_WINDOW_MS,
        },
    })
    async logout(
        @Req() request: Request,
        @Res({ passthrough: true }) response: Response,
    ): Promise<void> {
        const refreshToken = readRefreshTokenCookie(request);

        await this.authService.logout(refreshToken);

        clearRefreshTokenCookie(response, this.configService);
    }

    @Get('me')
    @UseGuards(AccessTokenGuard)
    getCurrentUser(@Req() request: AuthenticatedRequest): Promise<AuthUserResponse> {
        return this.authService.getCurrentUser(request.auth.userId);
    }
}
