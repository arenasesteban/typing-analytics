import { MongoNetworkError, MongoServerSelectionError } from 'mongodb';

export type OperationalSubsystem = 'postgresql' | 'mongodb' | 'application';

export type OperationalFailureCategory =
    'postgresql_unavailable' | 'mongodb_unavailable' | 'unexpected_failure';

export interface OperationalFailure {
    subsystem: OperationalSubsystem;
    category: OperationalFailureCategory;
    transient: boolean;
}

const TRANSIENT_PRISMA_CODES = new Set([
    'P1001', // Database server unreachable
    'P1002', // Database connection timed out
    'P1008', // Database operation timed out
    'P1017', // Database closed the connection
    'P2024', // Connection pool timeout
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function classifyOperationalFailure(error: unknown): OperationalFailure {
    if (
        isRecord(error) &&
        typeof error['code'] === 'string' &&
        TRANSIENT_PRISMA_CODES.has(error['code'])
    ) {
        return {
            subsystem: 'postgresql',
            category: 'postgresql_unavailable',
            transient: true,
        };
    }

    if (error instanceof MongoNetworkError || error instanceof MongoServerSelectionError) {
        return {
            subsystem: 'mongodb',
            category: 'mongodb_unavailable',
            transient: true,
        };
    }

    return {
        subsystem: 'application',
        category: 'unexpected_failure',
        transient: false,
    };
}
