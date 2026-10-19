import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import type { SessionEventDocument } from '../session-events/session-events.types.js';

@Injectable()
export class MongoService implements OnModuleDestroy {
    private readonly client: MongoClient;
    private readonly databaseName: string;

    constructor(config: ConfigService) {
        this.databaseName = config.getOrThrow<string>('MONGODB_DB');

        this.client = new MongoClient(config.getOrThrow<string>('MONGODB_URL'), {
            serverSelectionTimeoutMS: 2000,
        });
    }

    private get collection() {
        return this.client.db(this.databaseName).collection<SessionEventDocument>('session_events');
    }

    async ping(): Promise<void> {
        await this.client.db(this.databaseName).command({ ping: 1 });
    }

    async writeSessionEvents(document: SessionEventDocument): Promise<void> {
        await this.collection.updateOne(
            { _id: document._id },
            { $setOnInsert: document },
            { upsert: true },
        );
    }

    async findSessionEvents(sessionId: string): Promise<SessionEventDocument | null> {
        return this.collection.findOne({ _id: sessionId });
    }

    async onModuleDestroy(): Promise<void> {
        await this.client.close();
    }
}
