import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load environment variables berdasarkan folder tempat kamu berada
  const env = loadEnv(mode, process.cwd(), '');

  return {
    base: '/',
    plugins: [react()],
    optimizeDeps: {
      include: ['html2canvas', 'jspdf']
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      manifest: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    },
    server: {
      host: true,
      watch: {
        usePolling: true,
      },
      // Mengizinkan domain Ngrok di server, atau localhost di laptop
      allowedHosts: [ 'localhost:5173', 'dev-sip.sier.id'], 
      proxy: {
        '/api': {
          // DIAMBIL DARI .env Masing-masing
          target: env.VITE_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: false,
          secure: false,
          configure: (proxy) => {
            // Convert 404 → 204 for photo/blob endpoints so the browser
            // does NOT log them as red console errors (expected missing data)
            const silentEndpoints = [
              '/photo', '/ktm', '/bank-proof', '/bank_proof',
              '/foto-masuk', '/foto-pulang', '/templates/view'
            ];
            proxy.on('proxyRes', (proxyRes, req, res) => {
              if (
                proxyRes.statusCode === 404 &&
                silentEndpoints.some(p => (req.url || '').includes(p))
              ) {
                // Drain the backend response body so the socket is released
                proxyRes.resume();
                // Send 204 No Content to the browser — no error logged
                res.writeHead(204, {});
                res.end();
              }
            });
          },
        }
        ,
        '/storage': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: false,
          secure: false,
        }
      },
    },
    esbuild: {
      supported: { 'top-level-await': true },
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
  }
})