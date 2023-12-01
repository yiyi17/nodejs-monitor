import { defineConfig } from 'father';

export default defineConfig({
  // more father config: https://github.com/umijs/father/blob/master/docs/config.md
  esm: { output: 'dist/esm', input: 'src' },
  cjs: {
    output: 'dist',
    input: 'src'
  }
});
