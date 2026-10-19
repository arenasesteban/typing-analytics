import { describe, expect, it } from 'vitest';

import { validateEnvironment } from './env.validation.js';

const VALID_DATABASE_URL =
    'postgresql://typing_analytics:typing_analytics_local@localhost:5432/typing_analytics';

const VALID_MONGODB_URL = 'mongodb://127.0.0.1:27018';
const VALID_MONGODB_DB = 'typing_analytics_test';

const VALID_JWT_ACCESS_SECRET = 'typing-analytics-test-access-secret-0123456789abcdef';

const VALID_CONFIG = {
    NODE_ENV: 'test',
    DATABASE_URL: VALID_DATABASE_URL,
    MONGODB_URL: VALID_MONGODB_URL,
    MONGODB_DB: VALID_MONGODB_DB,
    EVENT_DELIVERY_AUTOSTART: 'false',
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
        expect(config['MONGODB_URL']).toBe(VALID_MONGODB_URL);
        expect(config['MONGODB_DB']).toBe(VALID_MONGODB_DB);
        expect(config['EVENT_DELIVERY_AUTOSTART']).toBe(false);
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
                ...VALID_CONFIG,
                DATABASE_URL: undefined,
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
                ...VALID_CONFIG,
                JWT_ACCESS_SECRET: undefined,
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

    it('rejects a missing MongoDB URL', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                MONGODB_URL: undefined,
            }),
        ).toThrow('MONGODB_URL is required');
    });

    it('rejects an invalid MongoDB URL protocol', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                MONGODB_URL: 'http://localhost:27017',
            }),
        ).toThrow('MONGODB_URL must use the mongodb or mongodb+srv protocol');
    });

    it('rejects a missing MongoDB database name', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                MONGODB_DB: undefined,
            }),
        ).toThrow('MONGODB_DB is required');
    });

    it('rejects an invalid MongoDB database name', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                MONGODB_DB: 'invalid/database',
            }),
        ).toThrow('MONGODB_DB must be a valid database name');
    });

    it('rejects an invalid event delivery autostart value', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                EVENT_DELIVERY_AUTOSTART: 'invalid',
            }),
        ).toThrow('EVENT_DELIVERY_AUTOSTART must be true or false');
    });

    it('defaults event delivery autostart based on the environment', () => {
        const testing = validateEnvironment({
            ...VALID_CONFIG,
            NODE_ENV: 'test',
            EVENT_DELIVERY_AUTOSTART: undefined,
        });

        const development = validateEnvironment({
            ...VALID_CONFIG,
            NODE_ENV: 'development',
            EVENT_DELIVERY_AUTOSTART: undefined,
        });

        expect(testing['EVENT_DELIVERY_AUTOSTART']).toBe(false);
        expect(development['EVENT_DELIVERY_AUTOSTART']).toBe(true);
    });

    it('rejects a missing Node environment', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                NODE_ENV: undefined,
            }),
        ).toThrow('NODE_ENV is required');
    });

    it('rejects an unsupported Node environment', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                NODE_ENV: 'staging',
            }),
        ).toThrow('NODE_ENV must be development, test, or production');
    });

    it('keeps local defaults in development', () => {
        const config = validateEnvironment({
            ...VALID_CONFIG,
            NODE_ENV: 'development',
            PORT: undefined,
            WEB_ORIGIN: undefined,
        });

        expect(config['PORT']).toBe(3001);
        expect(config['WEB_ORIGIN']).toBe('http://localhost:3000');
    });

    it('keeps local defaults in test', () => {
        const config = validateEnvironment({
            ...VALID_CONFIG,
            PORT: undefined,
            WEB_ORIGIN: undefined,
        });

        expect(config['PORT']).toBe(3001);
        expect(config['WEB_ORIGIN']).toBe('http://localhost:3000');
    });

    it('accepts explicit production configuration', () => {
        const config = validateEnvironment({
            ...VALID_CONFIG,
            NODE_ENV: 'production',
            WEB_ORIGIN: 'https://app.example.com',
            DATABASE_URL: 'postgresql://user:password@db.example.com:5432/typing_analytics',
            MONGODB_URL: 'mongodb+srv://cluster.example.com',
        });

        expect(config['NODE_ENV']).toBe('production');
        expect(config['WEB_ORIGIN']).toBe('https://app.example.com');
        expect(config['PORT']).toBe(3001);
    });

    it('rejects a missing production port', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                NODE_ENV: 'production',
                PORT: undefined,
                WEB_ORIGIN: 'https://app.example.com',
            }),
        ).toThrow('PORT is required in production');
    });

    it('rejects a missing production web origin', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                NODE_ENV: 'production',
                WEB_ORIGIN: undefined,
            }),
        ).toThrow('WEB_ORIGIN is required in production');
    });

    it('rejects an HTTP production web origin', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                NODE_ENV: 'production',
                WEB_ORIGIN: 'http://app.example.com',
            }),
        ).toThrow('WEB_ORIGIN must be a non-local HTTPS origin in production');
    });

    it('rejects a loopback production web origin', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                NODE_ENV: 'production',
                WEB_ORIGIN: 'https://localhost:3000',
            }),
        ).toThrow('WEB_ORIGIN must be a non-local HTTPS origin in production');
    });

    it('rejects an invalid PostgreSQL URL', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                DATABASE_URL: 'not-a-postgres-url',
            }),
        ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
    });

    it('rejects a PostgreSQL URL without a database name', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                DATABASE_URL: 'postgresql://localhost:5432',
            }),
        ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
    });

    it('accepts the postgres protocol', () => {
        const config = validateEnvironment({
            ...VALID_CONFIG,
            DATABASE_URL: 'postgres://user:password@db.example.com:5432/typing_analytics',
        });

        expect(config['DATABASE_URL']).toBe(
            'postgres://user:password@db.example.com:5432/typing_analytics',
        );
    });

    it('rejects a MongoDB URL without a server', () => {
        expect(() =>
            validateEnvironment({
                ...VALID_CONFIG,
                MONGODB_URL: 'mongodb://',
            }),
        ).toThrow('MONGODB_URL must contain a valid server authority');
    });

    it('preserves MongoDB multi-host connection strings', () => {
        const mongoUrl = 'mongodb://mongo1:27017,mongo2:27017/typing_analytics';

        const config = validateEnvironment({
            ...VALID_CONFIG,
            MONGODB_URL: mongoUrl,
        });

        expect(config['MONGODB_URL']).toBe(mongoUrl);
    });

    it('does not expose database credentials in validation errors', () => {
        const secret = 'sensitive-password-value';

        try {
            validateEnvironment({
                ...VALID_CONFIG,
                DATABASE_URL: `invalid://${secret}`,
            });

            expect.fail('Expected configuration validation to fail');
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain('DATABASE_URL');
            expect((error as Error).message).not.toContain(secret);
        }
    });
});
