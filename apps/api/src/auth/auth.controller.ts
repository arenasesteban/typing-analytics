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
