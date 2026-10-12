/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mdx from '@mdx-js/rollup'
import { devFs } from '@immediately-run/dev-fs'

// MDX must run before @vitejs/plugin-react so the JSX it emits is handled by
// React's transform (Fast Refresh included). immediately.run processes .mdx
// natively; this wiring keeps the local `vite dev`/`build` in sync.
//
// devFs() (@immediately-run/dev-fs) makes `import ... from 'fs'` work during
// local `vite dev`, bridging the same async ZenFS surface immediately.run
// provides to your real disk. It is dev-only and absent from production builds.
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // This VM's /etc/hosts carries no `localhost` entry, and vite resolves the dev
  // server's hostname at startup — name the loopback address explicitly or every
  // `vite dev`/`vitest run` dies with ENOTFOUND localhost.
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  plugins: [
    // The local vite dev bridge only exists for `vite dev`/`build`; vitest has no
    // fs bridge to prove (and this VM resolves no `localhost` for its server).
    ...(mode === 'test' ? [] : [devFs()]),
    { enforce: 'pre', ...mdx() },
    react(),
  ],
  test: {
    environment: 'jsdom',
    // Vitest runs the config with mode 'test'.
    mode: 'test',
    environmentOptions: {
      jsdom: {
        // This VM resolves no `localhost` (no /etc/hosts entry); 127.0.0.1 is the
        // same loopback and jsdom only ever parses URLs against it.
        url: 'http://127.0.0.1:3000/',
      },
    },
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
