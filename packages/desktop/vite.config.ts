import { defineConfig } from "vite"
import appPlugin from "@railwise/app/vite"

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig({
  plugins: [appPlugin],
  publicDir: "../app/public",
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  esbuild: {
    // Improves production stack traces
    keepNames: true,
  },
  build: {
    // sourcemap: true,
    // Performance optimizations for startup
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'solid': ['solid-js'],
          'tauri': ['@tauri-apps/api'],
          'railwise-app': ['@railwise/app'],
          'railwise-ui': ['@railwise/ui']
        }
      }
    },
    // Performance budget warnings
    chunkSizeWarningLimit: 1000, // Warn for chunks > 1MB
    // Enable bundle analysis in development
    ...(process.env.ANALYZE && {
      rollupOptions: {
        output: {
          manualChunks: undefined // Let rollup-plugin-visualizer handle this
        }
      }
    })
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
})
