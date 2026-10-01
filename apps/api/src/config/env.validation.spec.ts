import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './env.validation.js';

describe('validateEnvironment', () => {
    it('returns normalized configuration', () => {
        const config = validateEnvironment({
            DATABASE_URL:
                'postgresql://typing_analytics:typing_analytics_local@localhost:5432/typing_analytics',
            PORT: '3001',
        });

        expect(config['PORT']).toBe(3001);
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
});
