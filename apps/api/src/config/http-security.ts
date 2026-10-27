import type { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

const HSTS_MAX_AGE_SECONDS = 31_536_000;

export function configureHttpSecurity(app: INestApplication, configService: ConfigService): void {
    const environment = configService.getOrThrow<string>('NODE_ENV');
    const allowedOrigin = configService.getOrThrow<string>('WEB_ORIGIN');
    const localContainerDelivery = configService.get<boolean>('LOCAL_CONTAINER_DELIVERY') === true;

    const secureProduction = environment === 'production' && !localContainerDelivery;

    app.useSecurityHeaders({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: false,
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin',
        },
        xFrameOptions: {
            action: 'deny',
        },
        strictTransportSecurity: secureProduction
            ? {
                  maxAge: HSTS_MAX_AGE_SECONDS,
                  includeSubDomains: false,
              }
            : false,
    });

    app.enableCors({
        origin: (
            requestOrigin: string | undefined,
            callback: (error: Error | null, allow?: boolean) => void,
        ): void => {
            callback(null, requestOrigin === allowedOrigin);
        },
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        optionsSuccessStatus: 204,
    });
}
