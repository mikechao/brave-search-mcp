import antfu from '@antfu/eslint-config';

export default antfu({
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
});
