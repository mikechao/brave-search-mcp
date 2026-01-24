import antfu from '@antfu/eslint-config'

export default antfu({
  unocss: true,
  react: true,
  formatters: true,
  typescript: {
    overrides: {
      'no-console': 'off',
    },
  },
  stylistic: {
    semi: true,
    indent: 2,
    quotes: 'single',
  },
})
