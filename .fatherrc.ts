import { defineConfig } from 'father';

export default defineConfig({
  sourcemap: true,
  // more father config: https://github.com/umijs/father/blob/master/docs/config.md
  esm: { output: 'dist/esm', input: 'src' },
  cjs: {
    output: 'dist',
    input: 'src'
  }
});
