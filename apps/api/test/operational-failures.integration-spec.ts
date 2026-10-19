import {
    Controller,
    Get,
    Logger,
    ServiceUnavailableException,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { MongoNetworkError } from 'mongodb';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { OperationalExceptionFilter } from '../src/observability/operational-exception.filter.js';

const SENSITIVE_VALUE = 'secret-password-token-connection-string';

@Controller('operational-test')
class OperationalTestController {
    @Get('postgres')
    postgres(): never {
        throw Object.assign(new Error(SENSITIVE_VALUE), {
            code: 'P1001',
        });
    }

    @Get('mongodb')
    mongodb(): never {
        throw new MongoNetworkError(SENSITIVE_VALUE);
    }

    @Get('unexpected')
    unexpected(): never {
        throw new Error(SENSITIVE_VALUE);
    }

    @Get('unauthorized')
    unauthorized(): never {
        throw new UnauthorizedException('Invalid credentials');
    }

    @Get('forbidden')
    forbidden(): never {
        throw new ForbiddenException('Forbidden resource');
    }

    @Get('readiness')
    readiness(): never {
        throw new ServiceUnavailableException({
            status: 'degraded',
            dependencies: {
                postgresql: 'up',
                mongodb: 'down',
            },
        });
    }
}

describe('Operational HTTP failures', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [OperationalTestController],
        }).compile();

        app = moduleRef.createNestApplication();

        const adapterHost = app.get(HttpAdapterHost);

        app.useGlobalFilters(new OperationalExceptionFilter(adapterHost.httpAdapter));

        await app.init();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns a sanitized 503 for PostgreSQL outages', async () => {
        const response = await request(app.getHttpServer())
            .get('/operational-test/postgres')
            .expect(503);

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 503,
                message: 'A required service is temporarily unavailable',
            }),
        );

        expect(JSON.stringify(response.body)).not.toContain(SENSITIVE_VALUE);
    });

    it('returns a sanitized 503 for MongoDB outages', async () => {
        const response = await request(app.getHttpServer())
            .get('/operational-test/mongodb')
            .expect(503);

        expect(JSON.stringify(response.body)).not.toContain(SENSITIVE_VALUE);
    });

    it('returns a generic 500 for unexpected failures', async () => {
        const response = await request(app.getHttpServer())
            .get('/operational-test/unexpected')
            .expect(500);

        expect(JSON.stringify(response.body)).not.toContain(SENSITIVE_VALUE);

        expect(response.body).toEqual(
            expect.objectContaining({
                statusCode: 500,
                message: 'Internal server error',
            }),
        );
    });

    it('preserves authentication failure semantics', async () => {
        const response = await request(app.getHttpServer())
            .get('/operational-test/unauthorized')
            .expect(401);

        expect(response.body.message).toBe('Invalid credentials');
    });

    it('preserves authorization failure semantics', async () => {
        await request(app.getHttpServer()).get('/operational-test/forbidden').expect(403);
    });

    it('preserves the existing readiness payload', async () => {
        const response = await request(app.getHttpServer())
            .get('/operational-test/readiness')
            .expect(503);

        expect(response.body).toEqual({
            status: 'degraded',
            dependencies: {
                postgresql: 'up',
                mongodb: 'down',
            },
        });
    });

    it('logs only approved PostgreSQL failure categories', async () => {
        const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

        await request(app.getHttpServer()).get('/operational-test/postgres').expect(503);

        const logs = loggerSpy.mock.calls.map(([message]) => String(message)).join('\n');

        expect(logs).toContain('subsystem=postgresql');
        expect(logs).toContain('category=postgresql_unavailable');
        expect(logs).not.toContain(SENSITIVE_VALUE);
    });

    it('does not log unexpected exception details', async () => {
        const loggerSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

        await request(app.getHttpServer()).get('/operational-test/unexpected').expect(500);

        const logs = loggerSpy.mock.calls.map(([message]) => String(message)).join('\n');

        expect(logs).toContain('category=unexpected_failure');
        expect(logs).not.toContain(SENSITIVE_VALUE);
    });
});
