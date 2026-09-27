import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

export const baseConfig = defineConfig([
    globalIgnores(['**/node_modules/**', '**/dist/**', '**/coverage/**']),

    {
        files: ['**/*.{js,cjs,mjs,jsx}'],
        extends: [js.configs.recommended],
    },

    {
        files: ['**/*.{ts,cts,mts,tsx}'],
        extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
            },
        },
    },
]);

export default defineConfig([...baseConfig, eslintConfigPrettier]);
