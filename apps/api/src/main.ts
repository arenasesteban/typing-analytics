import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureHttpSecurity } from './config/http-security.js';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    app.enableShutdownHooks();

    const configService = app.get(ConfigService);
    const port = configService.getOrThrow<number>('PORT');

    configureHttpSecurity(app, configService);

    await app.listen(port);
}

void bootstrap();
