import antfu from '@antfu/eslint-config';

export default antfu({
  unocss: false,
  react: true,
  formatters: true,
  rules: {
    // This project exports helper values alongside components in a few files.
    'react-refresh/only-export-components': 'off',
  },
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
