import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Le front appelle /api/... et Vite relaie vers FastAPI sans le préfixe :
      // /api/health -> http://127.0.0.1:8000/health. Pas besoin de CORS côté backend.
      '/api': {
        target: 'http://127.0.0.1:8000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    // jsdom simule un navigateur pour que les tests tournent sans en ouvrir un
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
