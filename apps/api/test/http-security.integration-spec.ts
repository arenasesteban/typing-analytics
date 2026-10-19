import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { configureHttpSecurity } from '../src/config/http-security.js';

describe('HTTP response security', () => {
    let app: INestApplication;
    let allowedOrigin: string;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();

        const configService = app.get(ConfigService);

        allowedOrigin = configService.getOrThrow<string>('WEB_ORIGIN');

        configureHttpSecurity(app, configService);

        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('applies security headers to successful API responses', async () => {
        const response = await request(app.getHttpServer()).get('/health/live').expect(200);

        expect(response.headers['x-content-type-options']).toBe('nosniff');

        expect(response.headers['x-frame-options']).toBe('DENY');

        expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

        expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('applies security headers to error responses', async () => {
        const response = await request(app.getHttpServer())
            .get('/nonexistent-security-route')
            .expect(404);

        expect(response.headers['x-content-type-options']).toBe('nosniff');

        expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('allows the configured browser origin with credentials', async () => {
        const response = await request(app.getHttpServer())
            .get('/health/live')
            .set('Origin', allowedOrigin)
            .expect(200);

        expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);

        expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not grant CORS access to an unapproved origin', async () => {
        const response = await request(app.getHttpServer())
            .get('/health/live')
            .set('Origin', 'https://untrusted.example')
            .expect(200);

        expect(response.headers['access-control-allow-origin']).toBeUndefined();

        expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('handles allowed credentialed preflight requests', async () => {
        const response = await request(app.getHttpServer())
            .options('/auth/refresh')
            .set('Origin', allowedOrigin)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'Content-Type')
            .expect(204);

        expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);

        expect(response.headers['access-control-allow-credentials']).toBe('true');

        expect(response.headers['access-control-allow-methods']).toContain('POST');

        expect(response.headers['access-control-allow-headers']).toContain('Content-Type');
    });

    it('does not grant CORS access to an unapproved preflight', async () => {
        const response = await request(app.getHttpServer())
            .options('/auth/refresh')
            .set('Origin', 'https://untrusted.example')
            .set('Access-Control-Request-Method', 'POST');

        expect(response.headers['access-control-allow-origin']).toBeUndefined();

        expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('preserves unauthenticated rejection for protected resources', async () => {
        const response = await request(app.getHttpServer())
            .get('/auth/me')
            .set('Origin', allowedOrigin)
            .expect(401);

        expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);

        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('does not enable HSTS in the test environment', async () => {
        const response = await request(app.getHttpServer()).get('/health/live').expect(200);

        expect(response.headers['strict-transport-security']).toBeUndefined();
    });
});
