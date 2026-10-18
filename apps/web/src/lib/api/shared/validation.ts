export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
    return (
        Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
    );
}

export function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

export function isNonNegativeFiniteNumber(value: unknown): value is number {
    return isFiniteNumber(value) && value >= 0;
}

export function isNullableFiniteNumber(value: unknown): value is number | null {
    return value === null || isFiniteNumber(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
    return isNonNegativeFiniteNumber(value) && Number.isSafeInteger(value);
}

export function isPositiveInteger(value: unknown): value is number {
    return isNonNegativeInteger(value) && value > 0;
}

export function isDateTimeString(value: unknown): value is string {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
