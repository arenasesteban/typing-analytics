import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './env.validation.js';

describe('validateEnvironment', () => {
    it('returns normalized configuration', () => {
        const config = validateEnvironment({
            DATABASE_URL:
                'postgresql://typing_analytics:typing_analytics_local@localhost:5432/typing_analytics',
            PORT: '3001',
            WEB_ORIGIN: 'http://localhost:3000/',
        });

        expect(config['PORT']).toBe(3001);
        expect(config['WEB_ORIGIN']).toBe('http://localhost:3000');
    });

    it('uses the local web origin by default', () => {
        const config = validateEnvironment({
            DATABASE_URL:
                'postgresql://typing_analytics:typing_analytics_local@localhost:5432/typing_analytics',
            PORT: '3001',
        });

        expect(config['WEB_ORIGIN']).toBe('http://localhost:3000');
    });

    it('rejects a missing database URL', () => {
        expect(() => validateEnvironment({ PORT: '3001' })).toThrow('DATABASE_URL is required');
    });

    it('rejects an invalid port', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL:
                    'postgresql://typing_analytics:typing_analytics_local@localhost:5432/typing_analytics',
                PORT: 'invalid',
            }),
        ).toThrow('PORT must be an integer between 1 and 65535');
    });

    it('rejects an invalid web origin', () => {
        expect(() =>
            validateEnvironment({
                DATABASE_URL:
                    'postgresql://typing_analytics:typing_analytics_local@localhost:5432/typing_analytics',
                PORT: '3001',
                WEB_ORIGIN: 'http://localhost:3000/path',
            }),
        ).toThrow('WEB_ORIGIN must be a valid HTTP or HTTPS origin');
    });
});
