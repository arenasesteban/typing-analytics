interface SecurityHeader {
    key: string;
    value: string;
}

interface SecurityHeaderRule {
    source: string;
    headers: SecurityHeader[];
}

const HSTS_MAX_AGE_SECONDS = 31_536_000;

export function getWebSecurityHeaderRules(isProduction: boolean): SecurityHeaderRule[] {
    const headers: SecurityHeader[] = [
        {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
        },
        {
            key: 'X-Frame-Options',
            value: 'DENY',
        },
        {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
        },
        {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
        },
    ];

    if (isProduction) {
        headers.push({
            key: 'Strict-Transport-Security',
            value: `max-age=${String(HSTS_MAX_AGE_SECONDS)}`,
        });
    }

    return [
        {
            source: '/:path*',
            headers,
        },
    ];
}
