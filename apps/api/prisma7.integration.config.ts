import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

if (process.env['DATABASE_URL'] === undefined) {
    const result = config({
        path: '.env.test.local',
    });

    if (result.error) {
        throw new Error(
            'Integration database configuration is missing. Create .env.test.local from .env.test.example.',
        );
    }
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: process.env['DATABASE_URL'],
    },
});
