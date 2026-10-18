import { Module } from '@nestjs/common';
import { MongoModule } from '../mongo/mongo.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EventDeliveryService } from './event-delivery.service.js';

@Module({
    imports: [PrismaModule, MongoModule],
    providers: [EventDeliveryService],
    exports: [EventDeliveryService],
})
export class SessionEventsModule {}
