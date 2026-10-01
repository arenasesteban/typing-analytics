import {
    BadRequestException,
    Injectable,
    PayloadTooLargeException,
    type PipeTransform,
} from '@nestjs/common';
import type { TypingInput } from '@typing-analytics/typing-core';
import { MAX_COMPLETION_INPUTS } from './typing-sessions.constants.js';
import type { CompleteTypingSessionRequest } from './typing-sessions.types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
    const keys = Object.keys(value);

    return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
}

function isValidTimestamp(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= Number.MAX_SAFE_INTEGER
    );
}

function parseTypingInput(value: unknown): TypingInput {
    if (!isRecord(value)) {
        throw new BadRequestException('Each typing input must be an object');
    }

    if (value['type'] === 'insert') {
        if (!hasExactKeys(value, ['type', 'value', 'timestampMs'])) {
            throw new BadRequestException('Insert input contains invalid fields');
        }

        const inputValue = value['value'];
        const timestampMs = value['timestampMs'];

        if (typeof inputValue !== 'string' || Array.from(inputValue).length !== 1) {
            throw new BadRequestException('Insert input value must contain exactly one character');
        }

        if (!isValidTimestamp(timestampMs)) {
            throw new BadRequestException(
                'Typing input timestamp must be a finite, non-negative number',
            );
        }

        return {
            type: 'insert',
            value: inputValue,
            timestampMs,
        };
    }

    if (value['type'] === 'backspace') {
        if (!hasExactKeys(value, ['type', 'timestampMs'])) {
            throw new BadRequestException('Backspace input contains invalid fields');
        }

        const timestampMs = value['timestampMs'];

        if (!isValidTimestamp(timestampMs)) {
            throw new BadRequestException(
                'Typing input timestamp must be a finite, non-negative number',
            );
        }

        return {
            type: 'backspace',
            timestampMs,
        };
    }

    throw new BadRequestException('Unknown typing input type');
}

@Injectable()
export class CompleteTypingSessionPipe implements PipeTransform<
    unknown,
    CompleteTypingSessionRequest
> {
    transform(value: unknown): CompleteTypingSessionRequest {
        if (!isRecord(value) || !hasExactKeys(value, ['inputs'])) {
            throw new BadRequestException(
                'Typing session completion must contain only an inputs field',
            );
        }

        const inputs = value['inputs'];

        if (!Array.isArray(inputs)) {
            throw new BadRequestException('inputs must be an array');
        }

        if (inputs.length === 0) {
            throw new BadRequestException('inputs must contain at least one typing input');
        }

        if (inputs.length > MAX_COMPLETION_INPUTS) {
            throw new PayloadTooLargeException(
                `Typing session completion cannot contain more than ${MAX_COMPLETION_INPUTS} inputs`,
            );
        }

        return {
            inputs: inputs.map(parseTypingInput),
        };
    }
}
