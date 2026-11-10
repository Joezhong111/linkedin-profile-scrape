import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const shared = {
  plugins: {
    '@typescript-eslint': tseslint,
    react,
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    ...tseslint.configs.recommended.rules,
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    'react-refresh/only-export-components': 'warn',
    'react-hooks/set-state-in-effect': 'off',
    'no-empty': 'warn',
    'no-undef': 'off',
  },
};

export default [
  {
    ignores: [
      'dist',
      'node_modules',
      '.netlify',
      '.wrangler',
      'netlify',
      'drizzle',
      'drizzle-d1',
      'worker-configuration.d.ts',
      '*.config.js',
      '*.config.ts',
      'scripts',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['worker/**', 'test/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
      },
    },
    ...shared,
  },
  {
    // Worker code uses its own TypeScript project (no DOM, Workers globals).
    files: ['worker/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.worker.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: 'readonly',
        fetch: 'readonly',
      },
    },
    ...shared,
  },
];
