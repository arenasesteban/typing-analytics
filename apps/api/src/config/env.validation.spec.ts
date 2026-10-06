import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.validation.js';

const VALID_DATABASE_URL =
    'postgresql://typing_analytics:typing_analytics_local@localhost:5432/typing_analytics';

const VALID_JWT_ACCESS_SECRET = 'typing-analytics-test-access-secret-0123456789abcdef';

const VALID_CONFIG = {
    DATABASE_URL: VALID_DATABASE_URL,
    PORT: '3001',
    JWT_ACCESS_SECRET: VALID_JWT_ACCESS_SECRET,
    JWT_ACCESS_TTL_SECONDS: '900',
    REFRESH_TOKEN_TTL_DAYS: '30',
};

describe('validateEnvironment', () => {
    it('returns normalized configuration', () => {
        const config = validateEnvironment({
            ...VALID_CONFIG,
            NODE_ENV: 'test',
            WEB_ORIGIN: 'http://localhost:3000',
        });

        expect(config['NODE_ENV']).toBe('test');
        expect(config['DATABASE_URL']).toBe(VALID_DATABASE_URL);
        expect(config['PORT']).toBe(3001);
        expect(config['WEB_ORIGIN']).toBe('http://localhost:3000');
        expect(config['JWT_ACCESS_SECRET']).toBe(VALID_JWT_ACCESS_SECRET);
        expect(config['JWT_ACCESS_TTL_SECONDS']).toBe(900);
        expect(config['REFRESH_TOKEN_TTL_DAYS']).toBe(30);
    });

    it('uses the local web origin by default', () => {
        const config = validateEnvironment({
            ...VALID_CONFIG,
        });

        expect(config['WEB_ORIGIN']).toBe('http://localhost:3000');
    });

    it('rejects a missing database URL', () => {
        expect(() =>
            validateEnvironment({
                PORT: '3001',
                JWT_ACCESS_SECRET: VALID_JWT_ACCESS_SECRET,
                JWT_ACCESS_TTL_SECONDS: '900',
                REFRESH_TOKEN_TTL_DAYS: '30',
            }),
        ).toThrow('DATABASE_URL is required');
    });

    it('rejects an invalid port', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                PORT: 'invalid',
            }),
        ).toThrow('PORT must be an integer between 1 and 65535');
    });

    it('rejects an invalid web origin', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                WEB_ORIGIN: 'http://localhost:3000/path',
            }),
        ).toThrow('WEB_ORIGIN must be a valid HTTP or HTTPS origin');
    });

    it('rejects a missing JWT access secret', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL: VALID_DATABASE_URL,
                PORT: '3001',
                JWT_ACCESS_TTL_SECONDS: '900',
                REFRESH_TOKEN_TTL_DAYS: '30',
            }),
        ).toThrow('JWT_ACCESS_SECRET is required');
    });

    it('rejects a JWT access secret shorter than 32 bytes', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                JWT_ACCESS_SECRET: 'too-short',
            }),
        ).toThrow('JWT_ACCESS_SECRET must contain at least 32 bytes');
    });

    it('rejects an invalid access token lifetime', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                JWT_ACCESS_TTL_SECONDS: '59',
            }),
        ).toThrow('JWT_ACCESS_TTL_SECONDS must be an integer between 60 and 3600');
    });

    it('rejects an invalid refresh token lifetime', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                REFRESH_TOKEN_TTL_DAYS: '0',
            }),
        ).toThrow('REFRESH_TOKEN_TTL_DAYS must be an integer between 1 and 90');
    });
});
