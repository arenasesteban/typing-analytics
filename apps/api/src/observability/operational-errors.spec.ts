import { MongoNetworkError } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { classifyOperationalFailure } from './operational-errors.js';

describe('Operational error classification', () => {
    it.each(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])(
        'classifies Prisma %s as transient PostgreSQL failure',
        (code) => {
            const error = Object.assign(new Error('sensitive-postgres-connection-string'), {
                code,
            });

            expect(classifyOperationalFailure(error)).toEqual({
                subsystem: 'postgresql',
                category: 'postgresql_unavailable',
                transient: true,
            });
        },
    );

    it('classifies MongoDB network failures', () => {
        const error = new MongoNetworkError('sensitive-mongodb-connection-string');

        expect(classifyOperationalFailure(error)).toEqual({
            subsystem: 'mongodb',
            category: 'mongodb_unavailable',
            transient: true,
        });
    });

    it('does not treat Prisma constraint errors as outages', () => {
        const error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

        expect(classifyOperationalFailure(error)).toEqual({
            subsystem: 'application',
            category: 'unexpected_failure',
            transient: false,
        });
    });

    it('does not expose arbitrary error names or messages', () => {
        const error = new Error('password=secret accessToken=secret mongodb://secret');

        error.name = 'private-connection-string';

        const classification = classifyOperationalFailure(error);

        expect(classification).toEqual({
            subsystem: 'application',
            category: 'unexpected_failure',
            transient: false,
        });

        expect(JSON.stringify(classification)).not.toMatch(
            /password=|accessToken=|mongodb:\/\/|private-connection-string/,
        );
    });

    it('classifies unexpected thrown values safely', () => {
        expect(classifyOperationalFailure(null)).toEqual({
            subsystem: 'application',
            category: 'unexpected_failure',
            transient: false,
        });
    });
});
