const MINIMUM_JWT_SECRET_BYTES = 32;

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

function normalizeNodeEnvironment(value: unknown): 'development' | 'test' | 'production' {
    const candidate = typeof value === 'string' && value.length > 0 ? value : 'development';

    if (candidate !== 'development' && candidate !== 'test' && candidate !== 'production') {
        throw new Error('NODE_ENV must be development, test, or production');
    }

    return candidate;
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
    const databaseUrl = requireNonEmptyString(config, 'DATABASE_URL');

    const mongoUrl = requireNonEmptyString(config, 'MONGODB_URL');
    const mongoDatabase = validateMongoDatabaseName(requireNonEmptyString(config, 'MONGODB_DB'));
    const nodeEnvironment = normalizeNodeEnvironment(config['NODE_ENV']);

    if (!mongoUrl.startsWith('mongodb://') && !mongoUrl.startsWith('mongodb+srv://')) {
        throw new Error('MONGODB_URL must use the mongodb or mongodb+srv protocol');
    }

    const jwtAccessSecret = requireNonEmptyString(config, 'JWT_ACCESS_SECRET');

    if (Buffer.byteLength(jwtAccessSecret, 'utf8') < MINIMUM_JWT_SECRET_BYTES) {
        throw new Error(
            `JWT_ACCESS_SECRET must contain at least ${MINIMUM_JWT_SECRET_BYTES} bytes`,
        );
    }

    return {
        ...config,
        NODE_ENV: nodeEnvironment,
        DATABASE_URL: databaseUrl,
        PORT: parseInteger(
            {
                ...config,
                PORT: config['PORT'] ?? 3001,
            },
            'PORT',
            1,
            65535,
        ),
        WEB_ORIGIN: normalizeWebOrigin(config['WEB_ORIGIN']),
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
