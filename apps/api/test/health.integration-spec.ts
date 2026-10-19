import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { MongoService } from '../src/mongo/mongo.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Operational health and readiness', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let mongo: MongoService;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
        mongo = app.get(MongoService);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns liveness without authentication', async () => {
        const response = await request(app.getHttpServer()).get('/health/live').expect(200);

        expect(response.body).toEqual({ status: 'ok' });
    });

    it('returns readiness when PostgreSQL and MongoDB are available', async () => {
        const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

        expect(response.body).toEqual({
            status: 'ready',
            dependencies: {
                postgresql: 'up',
                mongodb: 'up',
            },
        });
    });

    it('reports MongoDB degradation without declaring PostgreSQL unavailable', async () => {
        vi.spyOn(mongo, 'ping').mockRejectedValue(new Error('Simulated MongoDB outage'));

        const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

        expect(response.body).toEqual({
            status: 'degraded',
            dependencies: {
                postgresql: 'up',
                mongodb: 'down',
            },
        });
    });

    it('reports PostgreSQL unavailability', async () => {
        vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('Simulated PostgreSQL outage'));

        const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

        expect(response.body).toEqual({
            status: 'unavailable',
            dependencies: {
                postgresql: 'down',
                mongodb: 'up',
            },
        });
    });

    it('reports both dependencies unavailable', async () => {
        vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('Simulated PostgreSQL outage'));
        vi.spyOn(mongo, 'ping').mockRejectedValue(new Error('Simulated MongoDB outage'));

        const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

        expect(response.body).toEqual({
            status: 'unavailable',
            dependencies: {
                postgresql: 'down',
                mongodb: 'down',
            },
        });
    });

    it('keeps liveness available when readiness dependencies fail', async () => {
        vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('Simulated PostgreSQL outage'));
        vi.spyOn(mongo, 'ping').mockRejectedValue(new Error('Simulated MongoDB outage'));

        await request(app.getHttpServer()).get('/health/ready').expect(503);

        const response = await request(app.getHttpServer()).get('/health/live').expect(200);

        expect(response.body).toEqual({ status: 'ok' });
    });

    it('bounds readiness time when MongoDB does not respond', async () => {
        vi.spyOn(mongo, 'ping').mockImplementation(() => new Promise<void>(() => {}));

        const startedAt = Date.now();

        const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

        const elapsedMs = Date.now() - startedAt;

        expect(elapsedMs).toBeLessThan(4_000);
        expect(response.body).toEqual({
            status: 'degraded',
            dependencies: {
                postgresql: 'up',
                mongodb: 'down',
            },
        });
    });

    it('does not expose dependency error details', async () => {
        const secret = 'private-connection-password';

        vi.spyOn(mongo, 'ping').mockRejectedValue(
            new Error(`MongoDB connection failed: ${secret}`),
        );

        const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

        const payload = JSON.stringify(response.body);

        expect(payload).not.toContain(secret);
        expect(payload).not.toContain('stack');
        expect(payload).not.toContain('mongodb://');
        expect(response.body).toMatchObject({
            status: 'degraded',
            dependencies: {
                mongodb: 'down',
            },
        });
    });

    it('does not modify the transactional outbox when MongoDB readiness fails', async () => {
        const outboxCountBefore = await prisma.sessionEventOutbox.count();

        vi.spyOn(mongo, 'ping').mockRejectedValue(new Error('Simulated MongoDB outage'));

        await request(app.getHttpServer()).get('/health/ready').expect(503);

        const outboxCountAfter = await prisma.sessionEventOutbox.count();

        expect(outboxCountAfter).toBe(outboxCountBefore);
    });
});
