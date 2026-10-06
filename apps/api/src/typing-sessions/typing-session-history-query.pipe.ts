import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';

import {
    DEFAULT_HISTORY_PAGE,
    DEFAULT_HISTORY_PAGE_SIZE,
    MAX_HISTORY_PAGE_SIZE,
} from './typing-sessions.constants.js';
import type { TypingSessionHistoryQuery } from './typing-sessions.types.js';

const HISTORY_QUERY_KEYS = new Set(['page', 'pageSize']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePositiveInteger(value: unknown, fieldName: string, defaultValue: number): number {
    if (value === undefined) {
        return defaultValue;
    }

    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        throw new BadRequestException(`${fieldName} must be a positive integer`);
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed)) {
        throw new BadRequestException(`${fieldName} must be a safe positive integer`);
    }

    return parsed;
}

@Injectable()
export class TypingSessionHistoryQueryPipe implements PipeTransform<
    unknown,
    TypingSessionHistoryQuery
> {
    transform(value: unknown): TypingSessionHistoryQuery {
        if (!isRecord(value)) {
            throw new BadRequestException('History query parameters must be an object');
        }

        for (const key of Object.keys(value)) {
            if (!HISTORY_QUERY_KEYS.has(key)) {
                throw new BadRequestException(`Unknown history query parameter: ${key}`);
            }
        }

        const page = parsePositiveInteger(value['page'], 'page', DEFAULT_HISTORY_PAGE);

        const pageSize = parsePositiveInteger(
            value['pageSize'],
            'pageSize',
            DEFAULT_HISTORY_PAGE_SIZE,
        );

        if (pageSize > MAX_HISTORY_PAGE_SIZE) {
            throw new BadRequestException(
                `pageSize cannot be greater than ${MAX_HISTORY_PAGE_SIZE}`,
            );
        }

        const offset = (page - 1) * pageSize;

        if (!Number.isSafeInteger(offset)) {
            throw new BadRequestException('page is too large');
        }

        return {
            page,
            pageSize,
        };
    }
}
