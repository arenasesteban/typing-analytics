import type { NextConfig } from 'next';
import { getWebSecurityHeaderRules } from './src/config/security-headers';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (process.env.NODE_ENV === 'production' && !apiBaseUrl?.trim()) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is required in production');
}

if (apiBaseUrl?.trim()) {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(apiBaseUrl);
    } catch {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS origin');
    }

    if (
        (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
        parsedUrl.username.length > 0 ||
        parsedUrl.password.length > 0 ||
        parsedUrl.pathname !== '/' ||
        parsedUrl.search.length > 0 ||
        parsedUrl.hash.length > 0
    ) {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS origin');
    }

    if (process.env.NODE_ENV === 'production') {
        const hostname = parsedUrl.hostname;

        const isLocal =
            hostname === 'localhost' ||
            hostname.endsWith('.localhost') ||
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
            hostname === '0.0.0.0';

        if (parsedUrl.protocol !== 'https:' || isLocal) {
            throw new Error(
                'NEXT_PUBLIC_API_BASE_URL must be a non-local HTTPS origin in production',
            );
        }
    }
}

const nextConfig: NextConfig = {
    poweredByHeader: false,
    headers: () =>
        Promise.resolve(getWebSecurityHeaderRules(process.env.NODE_ENV === 'production')),
};

export default nextConfig;
