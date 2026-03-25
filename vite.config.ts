import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * SPA React : le client appelle le backend via `VITE_API_URL`
 * (voir `src/config/apiUrl.ts`, `.env.development`, `.env.production`).
 *
 * - Dev : http://localhost:4000 (serveur Express `npm run server`)
 * - Prod : https://pokeapp-production-52e4.up.railway.app (surcharge possible sur Vercel au build)
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})