import path from 'node:path';
import process from 'node:process';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error('INPUT environment variable is not set');
}

const isDevelopment = process.env.NODE_ENV === 'development';
const rootDir = path.resolve(process.cwd(), 'ui');
const srcDir = path.resolve(rootDir, 'src');
const inputPath = path.isAbsolute(INPUT) ? INPUT : path.resolve(rootDir, INPUT);
const reactShimPath = path.resolve(srcDir, 'shims/react-compat.js');

export default defineConfig({
  root: rootDir,
  plugins: [preact({ reactAliasesEnabled: false }), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${srcDir}/` },
      { find: 'react-dom/test-utils', replacement: 'preact/test-utils' },
      { find: 'react-dom', replacement: 'preact/compat' },
      { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
      { find: 'react/jsx-dev-runtime', replacement: 'preact/jsx-dev-runtime' },
      { find: /^react$/, replacement: reactShimPath },
    ],
  },
  build: {
    sourcemap: isDevelopment ? 'inline' : undefined,
    cssMinify: !isDevelopment,
    minify: isDevelopment ? false : 'terser',
    terserOptions: {
      compress: { passes: 2 },
      mangle: { toplevel: true },
    },
    rollupOptions: {
      input: inputPath,
    },
    outDir: path.resolve(process.cwd(), 'dist/ui'),
    emptyOutDir: false,
  },
});
