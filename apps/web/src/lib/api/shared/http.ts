import { isRecord } from './validation';

type ResponseValidator<T> = (value: unknown) => value is T;

type ApiErrorConstructor = new (message: string, status: number) => Error;

export interface ApiClientOptions {
    readonly ErrorClass: ApiErrorConstructor;
    readonly errorMessagePrefix: string;
    readonly invalidResponseMessage: string;
    readonly credentials?: RequestCredentials;
}

function getApiBaseUrl(): string {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

    if (configuredBaseUrl === undefined || configuredBaseUrl.trim().length === 0) {
        throw new Error('NEXT_PUBLIC_API_BASE_URL is required');
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(configuredBaseUrl);
    } catch {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS URL');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS URL');
    }

    return parsedUrl.toString().replace(/\/+$/, '');
}

async function readResponseBody(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function getErrorMessage(body: unknown, status: number, prefix: string): string {
    if (isRecord(body)) {
        const message = body['message'];

        if (typeof message === 'string' && message.length > 0) {
            return message;
        }

        if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
            return message.join(', ');
        }
    }

    return `${prefix} with status ${String(status)}`;
}

export function createApiClient(options: ApiClientOptions) {
    const { ErrorClass, errorMessagePrefix, invalidResponseMessage, credentials } = options;

    function buildRequestInit(init: RequestInit): RequestInit {
        return credentials === undefined ? init : { ...init, credentials };
    }

    async function requestJson<T>(
        path: string,
        init: RequestInit,
        isExpectedResponse: ResponseValidator<T>,
    ): Promise<T> {
        const response = await fetch(`${getApiBaseUrl()}${path}`, buildRequestInit(init));

        const body = await readResponseBody(response);

        if (!response.ok) {
            throw new ErrorClass(
                getErrorMessage(body, response.status, errorMessagePrefix),
                response.status,
            );
        }

        if (!isExpectedResponse(body)) {
            throw new Error(invalidResponseMessage);
        }

        return body;
    }

    async function requestVoid(path: string, init: RequestInit): Promise<void> {
        const response = await fetch(`${getApiBaseUrl()}${path}`, buildRequestInit(init));

        if (response.ok) {
            return;
        }

        const body = await readResponseBody(response);

        throw new ErrorClass(
            getErrorMessage(body, response.status, errorMessagePrefix),
            response.status,
        );
    }

    return {
        requestJson,
        requestVoid,
    };
}
