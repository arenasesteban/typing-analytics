import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../prisma/prisma.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import type { AuthSessionResponse, AuthUserResponse, IssuedAuthSession } from './auth.types.js';

interface UserIdentity {
    id: string;
    email: string;
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function hasPrismaErrorCode(error: unknown, expectedCode: string): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return false;
    }

    return (error as { code?: unknown }).code === expectedCode;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly passwordService: PasswordService,
        private readonly refreshTokenService: RefreshTokenService,
        private readonly jwtService: JwtService,
    ) {}

    async register(request: RegisterDto): Promise<IssuedAuthSession> {
        const email = normalizeEmail(request.email);
        const passwordHash = await this.passwordService.hash(request.password);

        let user: UserIdentity;

        try {
            user = await this.prisma.user.create({
                data: {
                    email,
                    passwordHash,
                },
                select: {
                    id: true,
                    email: true,
                },
            });
        } catch (error) {
            if (hasPrismaErrorCode(error, 'P2002')) {
                throw new ConflictException('An account with this email already exists');
            }

            throw error;
        }

        return this.issueAuthSession(user);
    }

    async login(request: LoginDto): Promise<IssuedAuthSession> {
        const email = normalizeEmail(request.email);

        const user = await this.prisma.user.findUnique({
            where: {
                email,
            },
            select: {
                id: true,
                email: true,
                passwordHash: true,
            },
        });

        if (user === null) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const passwordMatches = await this.passwordService.verify(
            user.passwordHash,
            request.password,
        );

        if (!passwordMatches) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.issueAuthSession({
            id: user.id,
            email: user.email,
        });
    }

    async refresh(refreshToken: string | undefined): Promise<IssuedAuthSession> {
        if (refreshToken === undefined) {
            throw new UnauthorizedException('Invalid or expired authentication session');
        }

        const tokenHash = this.refreshTokenService.hash(refreshToken);
        const now = new Date();

        const currentSession = await this.prisma.refreshSession.findUnique({
            where: {
                tokenHash,
            },
            select: {
                id: true,
                userId: true,
                expiresAt: true,
                revokedAt: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });

        if (
            currentSession === null ||
            currentSession.revokedAt !== null ||
            currentSession.expiresAt <= now
        ) {
            throw new UnauthorizedException('Invalid or expired authentication session');
        }

        const replacement = this.refreshTokenService.issue();

        await this.prisma.$transaction(async (transaction) => {
            const revoked = await transaction.refreshSession.updateMany({
                where: {
                    id: currentSession.id,
                    revokedAt: null,
                    expiresAt: {
                        gt: now,
                    },
                },
                data: {
                    revokedAt: now,
                },
            });

            if (revoked.count !== 1) {
                throw new UnauthorizedException('Invalid or expired authentication session');
            }

            await transaction.refreshSession.create({
                data: {
                    userId: currentSession.userId,
                    tokenHash: replacement.tokenHash,
                    expiresAt: replacement.expiresAt,
                },
            });
        });

        const response = await this.createAccessResponse(currentSession.user);

        return {
            response,
            refreshToken: replacement.token,
        };
    }

    async logout(refreshToken: string | undefined): Promise<void> {
        if (refreshToken === undefined) {
            return;
        }

        const tokenHash = this.refreshTokenService.hash(refreshToken);

        await this.prisma.refreshSession.updateMany({
            where: {
                tokenHash,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
    }

    async getCurrentUser(userId: string): Promise<AuthUserResponse> {
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                email: true,
            },
        });

        if (user === null) {
            throw new UnauthorizedException('Authentication required');
        }

        return user;
    }

    private async issueAuthSession(user: UserIdentity): Promise<IssuedAuthSession> {
        const accessResponse = await this.createAccessResponse(user);
        const refreshToken = this.refreshTokenService.issue();

        await this.prisma.refreshSession.create({
            data: {
                userId: user.id,
                tokenHash: refreshToken.tokenHash,
                expiresAt: refreshToken.expiresAt,
            },
        });

        return {
            response: accessResponse,
            refreshToken: refreshToken.token,
        };
    }

    private async createAccessResponse(user: UserIdentity): Promise<AuthSessionResponse> {
        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
        });

        return {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
            },
        };
    }
}
