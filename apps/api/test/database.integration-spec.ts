import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('PostgreSQL persistence baseline', () => {
    let app: INestApplication;
    let prisma: PrismaService;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleRef.createNestApplication();
        await app.init();

        prisma = app.get(PrismaService);
    });

    afterAll(async () => {
        await app.close();
    });

    it('connects to PostgreSQL', async () => {
        const result = await prisma.$queryRaw<Array<{ value: number }>>`
      SELECT 1 AS value
    `;

        expect(result[0]?.value).toBe(1);
    });

    it('contains the persistence baseline tables', async () => {
        const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('typing_texts', 'typing_sessions')
      ORDER BY table_name
    `;

        expect(tables.map(({ table_name }) => table_name)).toEqual([
            'typing_sessions',
            'typing_texts',
        ]);
    });
});
