import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'public', 'scripts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Read time through src/time/clockStore.ts (getNow/useNow).' },
        { object: 'performance', property: 'now', message: 'Use the simulated clock for domain time.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Read time through src/time/clockStore.ts (getNow/useNow).',
        },
      ],
    },
  },
  {
    files: ['src/time/clockStore.ts', 'tests/**', 'playwright.config.ts', 'src/features/honors/**', 'src/brand/matrix/**'],
    rules: { 'no-restricted-properties': 'off', 'no-restricted-syntax': 'off' },
  },
)
