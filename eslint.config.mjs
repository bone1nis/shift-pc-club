import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
const layers = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']
const boundaryRule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      upward: 'FSD imports must point to a lower layer or stay within the same slice.',
      public: 'Import slices through their public index, not a deep path.',
    },
  },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/')
    const owner = filename.match(/\/src\/(shared|entities|features|widgets|pages|app)\/([^/]+)/)
    return {
      ImportDeclaration(node) {
        const path = node.source.value
        if (typeof path !== 'string') return
        const target = path.match(
          /^@fsd\/(shared|entities|features|widgets|pages|app)\/([^/]+)(.*)$/,
        )
        if (!target) return
        if (target[3]) context.report({ node, messageId: 'public' })
        if (
          owner &&
          (layers.indexOf(target[1]) > layers.indexOf(owner[1]) ||
            (target[1] === owner[1] && target[2] !== owner[2]))
        )
          context.report({ node, messageId: 'upward' })
      },
    }
  },
}
export default ts.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/dist/**',
      '**/storybook-static/**',
      '**/coverage/**',
      '**/vendor/**',
      'packages/contracts/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: { 'vue/multi-word-component-names': 'off', 'vue/html-self-closing': 'off' },
  },
  {
    files: ['**/*.{ts,vue}'],
    plugins: { fsd: { rules: { boundaries: boundaryRule } } },
    rules: { 'fsd/boundaries': 'error' },
  },
  {
    files: ['**/*.{mjs,js,ts,vue}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        window: 'readonly',
        document: 'readonly',
        Headers: 'readonly',
        RequestInit: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        $fetch: 'readonly',
      },
    },
  },
  {
    // TypeScript уже проверяет неопределённые имена, включая DOM-типы.
    files: ['**/*.{ts,vue}'],
    rules: { 'no-undef': 'off', 'vue/require-default-prop': 'off' },
  },
  {
    // UiIcon вставляет SVG из собственного списка иконок (packages/ui/src/icons/data.ts), а не из пользовательского ввода.
    files: ['packages/ui/src/Icon.vue'],
    rules: { 'vue/no-v-html': 'off' },
  },
  prettier,
)
