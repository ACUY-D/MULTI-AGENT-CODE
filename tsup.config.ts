import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: false, // Temporalmente deshabilitado debido a errores menores de tipos
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node20',
  outDir: 'dist',
  shims: true,
  skipNodeModulesBundle: true,
  external: ['node:*'],
  treeshake: true,
  bundle: true,
  platform: 'node',
  loader: {
    '.json': 'json',
  },
});
