import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    files: ['public/config.js'],
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', '.vercel/**', 'public/sw.js']
  }
);
