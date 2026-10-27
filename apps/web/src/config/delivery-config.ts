interface WebDeliveryConfig {
    localContainerDelivery: boolean;
}

function isLocalHostname(hostname: string): boolean {
    return (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]' ||
        hostname === '0.0.0.0'
    );
}

function isLoopbackHostname(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function validateWebDeliveryConfig(
    apiBaseUrl: string | undefined,
    environment: string | undefined,
    localDeliveryValue: string | undefined,
): WebDeliveryConfig {
    if (
        localDeliveryValue !== undefined &&
        localDeliveryValue !== 'true' &&
        localDeliveryValue !== 'false'
    ) {
        throw new Error('LOCAL_CONTAINER_DELIVERY must be true or false');
    }

    const localContainerDelivery = localDeliveryValue === 'true';

    if (localContainerDelivery && environment !== 'production') {
        throw new Error('LOCAL_CONTAINER_DELIVERY requires NODE_ENV=production');
    }

    if (!apiBaseUrl?.trim()) {
        if (environment === 'production') {
            throw new Error('NEXT_PUBLIC_API_BASE_URL is required in production');
        }

        return { localContainerDelivery };
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(apiBaseUrl.trim());
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

    if (environment === 'production') {
        if (localContainerDelivery) {
            if (parsedUrl.protocol !== 'http:' || !isLoopbackHostname(parsedUrl.hostname)) {
                throw new Error(
                    'NEXT_PUBLIC_API_BASE_URL must be a loopback HTTP origin for local container delivery',
                );
            }
        } else if (parsedUrl.protocol !== 'https:' || isLocalHostname(parsedUrl.hostname)) {
            throw new Error(
                'NEXT_PUBLIC_API_BASE_URL must be a non-local HTTPS origin in production',
            );
        }
    }

    return { localContainerDelivery };
}
