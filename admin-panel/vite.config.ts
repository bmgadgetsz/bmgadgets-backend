import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to strip crossorigin attribute to prevent CORS blocking on same-origin serving
const removeCrossorigin = () => ({
  name: 'remove-crossorigin',
  transformIndexHtml(html: string) {
    return html.replace(/\s+crossorigin(=["'][^"']*["'])?/gi, '');
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeCrossorigin()],
  base: '/admin/',
  build: {
    outDir: '../public/admin',
    emptyOutDir: true,
    modulePreload: false,
  }
})
