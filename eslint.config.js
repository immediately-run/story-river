import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// reactRefresh.configs.vite enforces the React Fast Refresh rule: a module that
// exports a component must export ONLY components. This is what keeps the app
// HMR-safe inside immediately.run — keep it. Data goes in src/lib/, hooks in
// src/hooks/.
//
// G-CUST-7 / APP_CUSTOMIZATION_SPEC §6.2 (R3-881): the river composes Grove from
// PUBLIC exports only — `@immediately-run/grove/src/*` and every other deep path
// is banned. If a need appears that the exports do not meet, the move is a Grove
// item, never a deep import.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@immediately-run/grove/src', '@immediately-run/grove/src/*'],
              message: 'Compose Grove from its public exports ("@immediately-run/grove" and its export-map entries: ./app ./components ./theme.css ./styles.css ./manifest) only — G-CUST-7.',
            },
          ],
        },
      ],
    },
  },
  {
    // Vitest files run in node; keep the browser globals and add the test globals.
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.browser, describe: 'readonly', it: 'readonly', expect: 'readonly' },
    },
  },
])
