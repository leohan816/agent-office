import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['public/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: {
        URL: 'readonly',
        Response: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        self: 'readonly',
      },
    },
  },
  {
    // These guards validate untyped bytes at runtime even though their public
    // TypeScript contracts carry the narrowed literal types.
    files: [
      'src/domain/events/index.ts',
      'src/domain/decisions/gpt-package.ts',
      'src/persistence/file-store/checkpoint-store.ts',
      'src/persistence/file-store/projection-store.ts',
    ],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
    },
  },
  {
    files: ['tests/snapshot/gpt-package.test.ts'],
    rules: {
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['src/ui/**/*.tsx', 'tests/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
);
