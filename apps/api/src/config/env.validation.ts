function normalizeWebOrigin(value: unknown): string {
    const candidate =
        typeof value === 'string' && value.trim().length > 0
            ? value.trim()
            : 'http://localhost:3000';

    let parsedOrigin: URL;

    try {
        parsedOrigin = new URL(candidate);
    } catch {
        throw new Error('WEB_ORIGIN must be a valid HTTP or HTTPS origin');
    }

    if (
        (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') ||
        parsedOrigin.username.length > 0 ||
        parsedOrigin.password.length > 0 ||
        parsedOrigin.pathname !== '/' ||
        parsedOrigin.search.length > 0 ||
        parsedOrigin.hash.length > 0
    ) {
        throw new Error('WEB_ORIGIN must be a valid HTTP or HTTPS origin');
    }

    return parsedOrigin.origin;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
    const databaseUrl = config['DATABASE_URL'];

    if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
        throw new Error('DATABASE_URL is required');
    }

    const port = Number(config['PORT'] ?? 3001);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be an integer between 1 and 65535');
    }

    return {
        ...config,
        DATABASE_URL: databaseUrl,
        PORT: port,
        WEB_ORIGIN: normalizeWebOrigin(config['WEB_ORIGIN']),
    };
}
