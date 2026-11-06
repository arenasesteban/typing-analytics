import path from 'node:path';

import type { NextConfig } from 'next';

import { validateWebDeliveryConfig } from './src/config/delivery-config';
import { getWebSecurityHeaderRules } from './src/config/security-headers';

const isProduction = process.env.NODE_ENV === 'production';

const { localContainerDelivery } = validateWebDeliveryConfig(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NODE_ENV,
    process.env.LOCAL_CONTAINER_DELIVERY,
    process.env.API_UPSTREAM_ORIGIN,
);

const nextConfig: NextConfig = {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../..'),
    transpilePackages: ['@typing-analytics/typing-core'],
    poweredByHeader: false,

    headers: () =>
        Promise.resolve(getWebSecurityHeaderRules(isProduction && !localContainerDelivery)),

    rewrites() {
        const rawOrigin = process.env.API_UPSTREAM_ORIGIN?.trim();

        if (!rawOrigin) {
            return Promise.resolve([]);
        }

        const upstream = new URL(rawOrigin);

        const localHosts = new Set(['localhost', '127.0.0.1', 'api']);

        const secure = upstream.protocol === 'https:';
        const localHttp = upstream.protocol === 'http:' && localHosts.has(upstream.hostname);

        if (!secure && !localHttp) {
            throw new Error('API_UPSTREAM_ORIGIN must use HTTPS outside local development.');
        }

        if (
            upstream.username ||
            upstream.password ||
            upstream.pathname !== '/' ||
            upstream.search ||
            upstream.hash
        ) {
            throw new Error('API_UPSTREAM_ORIGIN must be an origin without credentials or paths.');
        }

        const routes = [
            '/auth/:path*',
            '/typing-texts/:path*',
            '/typing-sessions/:path*',
            '/analytics/:path*',
            '/health/:path*',
        ];

        return Promise.resolve(
            routes.map((route) => ({
                source: route,
                destination: `${upstream.origin}${route}`,
            })),
        );
    },
};

export default nextConfig;
