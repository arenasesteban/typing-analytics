import path from 'node:path';

import type { NextConfig } from 'next';

import { validateWebDeliveryConfig } from './src/config/delivery-config';
import { getWebSecurityHeaderRules } from './src/config/security-headers';

const isProduction = process.env.NODE_ENV === 'production';

const { localContainerDelivery } = validateWebDeliveryConfig(
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NODE_ENV,
    process.env.LOCAL_CONTAINER_DELIVERY,
);

const nextConfig: NextConfig = {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../..'),
    transpilePackages: ['@typing-analytics/typing-core'],
    poweredByHeader: false,
    headers: () =>
        Promise.resolve(getWebSecurityHeaderRules(isProduction && !localContainerDelivery)),
};

export default nextConfig;
