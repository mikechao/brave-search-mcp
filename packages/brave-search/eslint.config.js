import antfu from '@antfu/eslint-config';

export default antfu({
  react: false,
  unocss: false,
  formatters: true,
  ignores: ['dist/**', 'src/types.ts'],
  rules: {
    'ts/no-explicit-any': 'off',
  },
  stylistic: {
    semi: true,
    indent: 2,
    quotes: 'single',
  },
});
