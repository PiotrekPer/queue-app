// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Shared flat ESLint config for the whole Stoliq monorepo.
 * Kept intentionally light: correctness-oriented, not style-oriented
 * (Prettier owns formatting). Package-specific configs may extend this.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/public/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '**/generated/**',
      '**/next-env.d.ts',
      '**/*.config.{js,cjs,mjs,ts}',
      '**/metro.config.js',
      '**/babel.config.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // CommonJS artifacts (e.g. the NativeWind tailwind preset) — allow require/module.
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { require: 'readonly', module: 'writable', __dirname: 'readonly', process: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'no-console': 'off',
      'prefer-const': 'warn',
    },
  },
);
