import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts(), dts({ outDir: "cjs" })],
  build: {
    outDir: "es",
    rollupOptions: {
      input: 'lib/main.ts',
      output: [{
        dir: "cjs",
        preserveModules: true,
        format: 'cjs',
        entryFileNames: "[name].js",

      }, {
        dir: "es",
        format: 'es',
        preserveModules: true,
        entryFileNames: "[name].js",
      }, {
        dir: "dist",
        format: 'umd',
        entryFileNames: "pomelo-client.umd.js",
        name: 'PomeloClient',
      }],
    },
    lib: {
      entry: './lib/main.ts',
      formats: ["cjs", "es", "umd"]
    },
  }
})
