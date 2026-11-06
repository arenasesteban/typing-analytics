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
    apiUpstreamOrigin?: string,
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

    if (apiBaseUrl.trim() === '/') {
        if (localContainerDelivery) {
            throw new Error(
                'Same-origin API routing is incompatible with local container delivery',
            );
        }

        if (!apiUpstreamOrigin?.trim()) {
            throw new Error('API_UPSTREAM_ORIGIN is required for same-origin API routing');
        }

        let upstream: URL;

        try {
            upstream = new URL(apiUpstreamOrigin.trim());
        } catch {
            throw new Error('API_UPSTREAM_ORIGIN must be a valid HTTP or HTTPS origin');
        }

        const validLocalHttp =
            upstream.protocol === 'http:' &&
            (isLoopbackHostname(upstream.hostname) || upstream.hostname === 'api');

        const validProtocol =
            environment === 'production'
                ? upstream.protocol === 'https:' && !isLocalHostname(upstream.hostname)
                : upstream.protocol === 'https:' || validLocalHttp;

        if (
            !validProtocol ||
            upstream.username ||
            upstream.password ||
            upstream.pathname !== '/' ||
            upstream.search ||
            upstream.hash
        ) {
            throw new Error('API_UPSTREAM_ORIGIN must be a valid secure upstream origin');
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
