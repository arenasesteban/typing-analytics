import { defineConfig } from 'prisma/config';

const LOCAL_E2E_DATABASE_URL =
    'postgresql://typing_analytics:typing_analytics_e2e_local@localhost:5435/typing_analytics_e2e?schema=public';

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
    },
    datasource: {
        url: process.env['E2E_DATABASE_URL'] ?? LOCAL_E2E_DATABASE_URL,
    },
});
