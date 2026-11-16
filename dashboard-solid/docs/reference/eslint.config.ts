/**
 * ESLint flat config — the proposed rule set for dashboard-solid.
 * Layers: JS core → typescript-eslint (type-aware) → imports → Solid → i18n → per-folder overrides.
 */
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import i18next from 'eslint-plugin-i18next';
import { importX } from 'eslint-plugin-import-x';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Attributes that never hold user-visible text (Solid uses `class`, not React's `className`). */
const technicalAttributes = [
  'class', 'classList', 'style', 'id', 'for', 'type', 'name', 'role', 'href', 'src',
  'key', 'width', 'height', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'loading',
  'autocomplete', 'inputmode', 'method', 'target', 'rel', 'lang', 'dir', 'data-[a-z-]+',
];

export default defineConfig(
  globalIgnores(['dist/**', 'node_modules/**', 'coverage/**']),

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.config.ts'], defaultProject: 'tsconfig.tools.json' },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },

  // Every eslint-disable must name its rules and say why.
  comments.recommended,
  {
    rules: {
      '@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }],
      '@eslint-community/eslint-comments/no-unlimited-disable': 'error',
    },
  },

  // Core JavaScript: correctness and readability.
  {
    rules: {
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-console': 'error',
      // A Canvas 2D context is configured by assigning its properties (fillStyle, font…): that is its API.
      'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['context'] }],
      'no-nested-ternary': 'error',
      'no-implicit-coercion': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'prefer-template': 'error',
      'object-shorthand': ['error', 'always'],
      'default-case-last': 'error',
      'no-restricted-globals': ['error', 'isNaN', 'isFinite'],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
    },
  },

  // TypeScript: stricter than the presets where the project needs it.
  {
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      // Open types (string) need a default; unions keep exhaustiveness through `const _exhaustive: never = value` in their default.
      '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true }],
      '@typescript-eslint/strict-boolean-expressions': ['error', { allowNullableObject: true, allowNumber: false, allowString: false }],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/no-shadow': 'error',
      // `const { omitted, ...rest } = value` is the idiom for dropping a field.
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      '@typescript-eslint/naming-convention': ['error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // node:test describe/it return promises that the runner itself awaits.
      '@typescript-eslint/no-floating-promises': ['error', { allowForKnownSafeCalls: [{ from: 'package', package: 'node:test', name: ['describe', 'it', 'test', 'suite'] }] }],
      // Conflicts with no-non-null-assertion: it suggests `!`, which the strict preset forbids.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
    },
  },

  // Imports: no cycles, named exports, enforced layer boundaries.
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: { 'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })] },
    rules: {
      // TypeScript already resolves modules and named imports; these duplicate it and slow linting down.
      'import-x/no-unresolved': 'off',
      'import-x/namespace': 'off',
      'import-x/default': 'off',
      'import-x/named': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-restricted-paths': ['error', { zones: [
        { target: './src', from: './server', message: 'The UI talks to the server through the typed client only.' },
        { target: './server', from: './src', message: 'The server never imports UI code.' },
        { target: './shared', from: ['./src', './server'], message: 'shared/ stays independent of both sides.' },
      ] }],
    },
  },

  // Solid: reactivity rules, applied to UI code only.
  { files: ['src/**/*.{ts,tsx}'], ...solid },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'solid/prefer-for': 'error',
      'solid/prefer-show': 'error',
      'solid/self-closing-comp': 'error',
      'solid/no-react-specific-props': 'error',
      'solid/reactivity': 'error',
      'solid/no-destructure': 'error',
    },
  },

  // i18n: no user-visible literal in JSX text or attributes; no literal passed to notification helpers.
  {
    files: ['src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-only',
        'jsx-attributes': { exclude: technicalAttributes },
        words: { exclude: ['[0-9!-/:-@[-`{-~]+', '[A-Z_-]+', '·', '—'] },
      }],
      'no-restricted-syntax': ['error',
        { selector: 'CallExpression[callee.name=/^(notify|confirmAction)$/] > :matches(Literal, TemplateLiteral)', message: 'Pass a translated string: t(\'…\').' },
      ],
    },
  },

  // Overrides.
  { files: ['*.config.ts'], rules: { 'import-x/no-default-export': 'off' } },
  { files: ['scripts/**/*.ts'], rules: { 'no-console': 'off' } },
  { files: ['src/i18n/**/*.ts'], rules: { 'max-lines': 'off' } },
  { files: ['**/*.test.{ts,tsx}'], rules: { 'max-lines-per-function': 'off', '@typescript-eslint/no-non-null-assertion': 'off' } },
);
