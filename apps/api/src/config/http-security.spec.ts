import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { configureHttpSecurity } from './http-security.js';

function createAppMock() {
    const useSecurityHeaders = vi.fn();
    const enableCors = vi.fn();

    const app = {
        useSecurityHeaders,
        enableCors,
    } as unknown as INestApplication;

    return { app, useSecurityHeaders, enableCors };
}

function createConfig(localContainerDelivery: boolean): ConfigService {
    return new ConfigService({
        NODE_ENV: 'production',
        WEB_ORIGIN: localContainerDelivery ? 'http://localhost:3000' : 'https://app.example.com',
        LOCAL_CONTAINER_DELIVERY: localContainerDelivery,
    });
}

describe('HTTP security configuration', () => {
    it('enables HSTS in external production', () => {
        const { app, useSecurityHeaders } = createAppMock();

        configureHttpSecurity(app, createConfig(false));

        expect(useSecurityHeaders).toHaveBeenCalledWith(
            expect.objectContaining({
                strictTransportSecurity: {
                    maxAge: 31_536_000,
                    includeSubDomains: false,
                },
                xFrameOptions: { action: 'deny' },
            }),
        );
    });

    it('disables HSTS only for explicit local production delivery', () => {
        const { app, useSecurityHeaders } = createAppMock();

        configureHttpSecurity(app, createConfig(true));

        expect(useSecurityHeaders).toHaveBeenCalledWith(
            expect.objectContaining({
                strictTransportSecurity: false,
                xFrameOptions: { action: 'deny' },
                referrerPolicy: {
                    policy: 'strict-origin-when-cross-origin',
                },
            }),
        );
    });

    it('preserves credentialed CORS restricted to the configured origin', () => {
        const { app, enableCors } = createAppMock();

        configureHttpSecurity(app, createConfig(true));

        expect(enableCors).toHaveBeenCalledWith(
            expect.objectContaining({
                credentials: true,
                methods: ['GET', 'POST'],
                allowedHeaders: ['Content-Type', 'Authorization'],
            }),
        );

        const options = enableCors.mock.calls[0]?.[0] as {
            origin: (
                origin: string | undefined,
                callback: (error: Error | null, allowed?: boolean) => void,
            ) => void;
        };

        const callback = vi.fn();

        options.origin('http://localhost:3000', callback);
        expect(callback).toHaveBeenLastCalledWith(null, true);

        options.origin('http://evil.example.com', callback);
        expect(callback).toHaveBeenLastCalledWith(null, false);
    });
});
