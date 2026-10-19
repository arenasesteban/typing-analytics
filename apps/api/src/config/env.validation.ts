const MINIMUM_JWT_SECRET_BYTES = 32;

type NodeEnvironment = 'development' | 'test' | 'production';

function requireNonEmptyString(config: Record<string, unknown>, key: string): string {
    const value = config[key];

    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${key} is required`);
    }

    return value.trim();
}

function parseInteger(
    config: Record<string, unknown>,
    key: string,
    minimum: number,
    maximum: number,
): number {
    const value = Number(config[key]);

    if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
    }

    return value;
}

function normalizeNodeEnvironment(value: unknown): NodeEnvironment {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error('NODE_ENV is required');
    }

    const candidate = value.trim();

    if (candidate !== 'development' && candidate !== 'test' && candidate !== 'production') {
        throw new Error('NODE_ENV must be development, test, or production');
    }

    return candidate;
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

function normalizeWebOrigin(value: unknown, environment: NodeEnvironment): string {
    const candidate =
        typeof value === 'string' && value.trim().length > 0
            ? value.trim()
            : environment === 'production'
              ? null
              : 'http://localhost:3000';

    if (candidate === null) {
        throw new Error('WEB_ORIGIN is required in production');
    }

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

    if (
        environment === 'production' &&
        (parsedOrigin.protocol !== 'https:' || isLocalHostname(parsedOrigin.hostname))
    ) {
        throw new Error('WEB_ORIGIN must be a non-local HTTPS origin in production');
    }

    return parsedOrigin.origin;
}

function validatePostgresUrl(value: string): string {
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(value);
    } catch {
        throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }

    if (
        (parsedUrl.protocol !== 'postgresql:' && parsedUrl.protocol !== 'postgres:') ||
        parsedUrl.hostname.length === 0 ||
        parsedUrl.pathname.length <= 1
    ) {
        throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }

    return value;
}

function validateMongoUrl(value: string): string {
    const protocol = value.startsWith('mongodb+srv://')
        ? 'mongodb+srv://'
        : value.startsWith('mongodb://')
          ? 'mongodb://'
          : null;

    if (protocol === null) {
        throw new Error('MONGODB_URL must use the mongodb or mongodb+srv protocol');
    }

    const authority = value.slice(protocol.length).split(/[/?#]/, 1)[0];

    if (!authority || authority.endsWith('@') || /\s/.test(authority)) {
        throw new Error('MONGODB_URL must contain a valid server authority');
    }

    return value;
}

function parseBoolean(
    config: Record<string, unknown>,
    key: string,
    defaultValue: boolean,
): boolean {
    const value = config[key];

    if (value === undefined) return defaultValue;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;

    throw new Error(`${key} must be true or false`);
}

function validateMongoDatabaseName(value: string): string {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) {
        throw new Error('MONGODB_DB must be a valid database name');
    }

    return value;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
    const nodeEnvironment = normalizeNodeEnvironment(config['NODE_ENV']);

    const databaseUrl = validatePostgresUrl(requireNonEmptyString(config, 'DATABASE_URL'));
    const mongoUrl = validateMongoUrl(requireNonEmptyString(config, 'MONGODB_URL'));
    const mongoDatabase = validateMongoDatabaseName(requireNonEmptyString(config, 'MONGODB_DB'));

    const jwtAccessSecret = requireNonEmptyString(config, 'JWT_ACCESS_SECRET');

    if (Buffer.byteLength(jwtAccessSecret, 'utf8') < MINIMUM_JWT_SECRET_BYTES) {
        throw new Error(
            `JWT_ACCESS_SECRET must contain at least ${MINIMUM_JWT_SECRET_BYTES} bytes`,
        );
    }

    const portConfig = {
        ...config,
        PORT: config['PORT'] ?? (nodeEnvironment === 'production' ? undefined : 3001),
    };

    if (nodeEnvironment === 'production' && portConfig.PORT === undefined) {
        throw new Error('PORT is required in production');
    }

    return {
        ...config,
        NODE_ENV: nodeEnvironment,
        DATABASE_URL: databaseUrl,
        PORT: parseInteger(portConfig, 'PORT', 1, 65535),
        WEB_ORIGIN: normalizeWebOrigin(config['WEB_ORIGIN'], nodeEnvironment),
        JWT_ACCESS_SECRET: jwtAccessSecret,
        JWT_ACCESS_TTL_SECONDS: parseInteger(config, 'JWT_ACCESS_TTL_SECONDS', 60, 3600),
        REFRESH_TOKEN_TTL_DAYS: parseInteger(config, 'REFRESH_TOKEN_TTL_DAYS', 1, 90),
        MONGODB_URL: mongoUrl,
        MONGODB_DB: mongoDatabase,
        EVENT_DELIVERY_AUTOSTART: parseBoolean(
            config,
            'EVENT_DELIVERY_AUTOSTART',
            nodeEnvironment !== 'test',
        ),
    };
}
