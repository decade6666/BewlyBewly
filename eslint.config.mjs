import antfu from '@antfu/eslint-config'
import simpleImportSort from 'eslint-plugin-simple-import-sort'

export default antfu({
  formatters: {
    css: 'prettier',
    prettierOptions: {
      printWidth: 120,
      singleQuote: false,
    },
  },
  rules: {
    'vue/max-attributes-per-line': [
      'error',
      {
        singleline: {
          max: 5,
        },
        multiline: {
          max: 5,
        },
      },
    ],
    'no-alert': 'off',
    'style/quote-props': 'off',
  },
}, {
  // Global ignores - separate config object with ONLY ignores
  ignores: [
    '**/fixtures',
    '**/dist/**',
    '**/node_modules/**',
    '**/public/**',
    '**/extension/**',
    '**/extension-firefox/**',
    // Trellis workspace and task artifacts: runtime session data, active/archived task docs
    '**/.trellis/workspace/**',
    '**/.trellis/tasks/**',
    '**/.trellis/.backup-*/**',
  ],
}, {
  plugins: {
    'simple-import-sort': simpleImportSort,
  },
  rules: {
    'import/order': 'off',
    'sort-imports': 'off',
    'simple-import-sort/imports': 'error',
    'simple-import-sort/exports': 'error',
  },
})
