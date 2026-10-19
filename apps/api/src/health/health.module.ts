import { Module } from '@nestjs/common';

import { MongoModule } from '../mongo/mongo.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
    imports: [PrismaModule, MongoModule],
    controllers: [HealthController],
    providers: [HealthService],
})
export class HealthModule {}
