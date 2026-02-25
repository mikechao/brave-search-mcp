import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  minify: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  shims: true,
  noExternal: [/.*/],
  banner: {
    js: 'import { createRequire as __createRequire } from "module";\nconst require = __createRequire(import.meta.url);',
  },
});
