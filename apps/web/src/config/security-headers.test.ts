import { describe, expect, it } from 'vitest';

import { getWebSecurityHeaderRules } from './security-headers';

describe('Web security headers', () => {
    it('preserves baseline security headers without HSTS', () => {
        const rules = getWebSecurityHeaderRules(false);
        const headers = rules[0]?.headers ?? [];

        expect(headers).toEqual(
            expect.arrayContaining([
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            ]),
        );

        expect(headers.some((header) => header.key === 'Strict-Transport-Security')).toBe(false);
    });

    it('enables HSTS for secure production delivery', () => {
        const rules = getWebSecurityHeaderRules(true);
        const headers = rules[0]?.headers ?? [];

        expect(headers).toEqual(
            expect.arrayContaining([
                {
                    key: 'Strict-Transport-Security',
                    value: 'max-age=31536000',
                },
            ]),
        );
    });
});
