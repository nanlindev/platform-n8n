import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { ProxyOptions } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const n8nBase = (env.N8N_BASE_URL || 'http://127.0.0.1:5678').replace(/\/$/, '');
  const apiKey = env.N8N_API_KEY || '';

  const n8nProxy: ProxyOptions = {
    target: n8nBase,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/n8n-api/, '/api/v1'),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        if (apiKey) proxyReq.setHeader('X-N8N-API-KEY', apiKey);
      });
    },
  };

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5179,
      proxy: {
        '/n8n-api': n8nProxy,
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 5179,
      proxy: {
        '/n8n-api': n8nProxy,
      },
    },
  };
});
