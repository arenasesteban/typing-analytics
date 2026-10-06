import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    app.enableShutdownHooks();

    const configService = app.get(ConfigService);
    const port = configService.get<number>('PORT') ?? 3001;
    const webOrigin = configService.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';

    app.enableCors({
        origin: webOrigin,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    await app.listen(port);
}

void bootstrap();
