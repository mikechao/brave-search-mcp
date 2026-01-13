import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const INPUT = process.env.INPUT;
if (!INPUT) {
  throw new Error('INPUT environment variable is not set');
}

const isDevelopment = process.env.NODE_ENV === 'development';
const rootDir = path.resolve(process.cwd(), 'ui');
const inputPath = path.isAbsolute(INPUT) ? INPUT : path.resolve(rootDir, INPUT);

export default defineConfig({
  root: rootDir,
  plugins: [react(), viteSingleFile()],
  build: {
    sourcemap: isDevelopment ? 'inline' : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,
    rollupOptions: {
      input: inputPath,
    },
    outDir: path.resolve(process.cwd(), 'dist/ui'),
    emptyOutDir: false,
  },
});
