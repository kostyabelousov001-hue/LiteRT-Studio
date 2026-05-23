import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { join } from 'path'
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs'

// Custom plugin to copy wasm files from node_modules to public/wasm
const copyWasmFiles = () => {
  return {
    name: 'copy-wasm-files',
    configResolved() {
      const wasmDir = join(__dirname, 'node_modules', '@mediapipe', 'tasks-genai', 'wasm');
      const destDir = join(__dirname, 'public', 'wasm');

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      // If the wasm directory exists in node_modules, copy its contents
      if (existsSync(wasmDir)) {
        const files = readdirSync(wasmDir);
        files.forEach(file => {
          const src = join(wasmDir, file);
          const dest = join(destDir, file);
          if (existsSync(src)) {
            copyFileSync(src, dest);
            console.log(`Copied ${file} to public/wasm`);
          }
        });
      }
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyWasmFiles()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
        'krnlcamel.space',
        'www.krnlcamel.space',
        'api.krnlcamel.space',
        'localhost',
        '127.0.0.1',
        '.krnlcamel.space'
    ],
    cors: true,
    hmr: {
        host: 'krnlcamel.space',
        protocol: 'wss',
        clientPort: 443
    },
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/temp': 'http://127.0.0.1:3001',
      '/projects': 'http://127.0.0.1:3001',
      '/ws': {
        target: 'ws://127.0.0.1:3001',
        ws: true
      }
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  }
})
