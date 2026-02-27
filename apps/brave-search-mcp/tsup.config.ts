import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  minify: 'terser',
  terserOptions: {
    compress: { passes: 2 },
    mangle: { toplevel: true },
  },
  sourcemap: false,
  clean: true,
  splitting: false,
  dts: false,
  shims: true,
  noExternal: [/^(?!zod(?:\/.*)?$).+/],
  external: [/^zod(?:\/.*)?$/],
  banner: {
    js: 'import { createRequire as __createRequire } from "module";\nconst require = __createRequire(import.meta.url);',
  },
});
