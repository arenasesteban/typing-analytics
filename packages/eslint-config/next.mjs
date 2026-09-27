import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

import { baseConfig } from './base.mjs';

export default defineConfig([
    ...baseConfig,

    ...nextVitals,

    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),

    eslintConfigPrettier,
]);
