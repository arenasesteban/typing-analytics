import { ConfigService } from '@nestjs/config';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureHttpSecurity } from './config/http-security.js';
import { OperationalExceptionFilter } from './observability/operational-exception.filter.js';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);

    configureHttpSecurity(app, configService);

    const httpAdapterHost = app.get(HttpAdapterHost);

    app.useGlobalFilters(new OperationalExceptionFilter(httpAdapterHost.httpAdapter));

    app.enableShutdownHooks();

    const port = configService.getOrThrow<number>('PORT');

    await app.listen(port);
}

void bootstrap();
