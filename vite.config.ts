import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Automatically load local environment files into process.env for local development
if (typeof process.loadEnvFile === 'function') {
  const envLocalPath = path.resolve(__dirname, '.env.local');
  if (fs.existsSync(envLocalPath)) {
    try {
      process.loadEnvFile(envLocalPath);
    } catch {}
  }
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {}
  }
}

/**
 * Lightweight Vite plugin to emulate Vercel Serverless Functions in local development.
 * Automatically intercepts `/api/*` requests, loads the corresponding TypeScript handler,
 * and executes it with incoming request/response helpers.
 * Note: Paths prefixed with an underscore (e.g. `_lib/`) are ignored, matching Vercel's convention.
 */
function vercelApiDevPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
    config(_config, { mode }) {
      // Ensure all environment variables from .env and .env.local are populated in process.env
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, val] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (!url || !url.startsWith('/api/')) {
          return next();
        }

        // Parse JSON body for mutation requests if not already parsed
        let body: any = {};
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
          }
          const raw = Buffer.concat(buffers).toString('utf8');
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              body = raw;
            }
          }
        }

        // Parse query params from URL search string
        const searchStr = (req.url || '').split('?')[1];
        const query: Record<string, string> = {};
        if (searchStr) {
          const params = new URLSearchParams(searchStr);
          params.forEach((v, k) => {
            query[k] = v;
          });
        }

        (req as any).body = body;
        (req as any).query = query;

        // Augment res object with Express/Vercel-like helpers if missing
        if (!(res as any).status) {
          (res as any).status = function (code: number) {
            this.statusCode = code;
            return this;
          };
        }
        if (!(res as any).json) {
          (res as any).json = function (data: any) {
            this.setHeader('Content-Type', 'application/json');
            this.end(JSON.stringify(data));
          };
        }

        try {
          // Delegate directly to the production central router for 100% dev/prod parity
          const routerModule = await server.ssrLoadModule(path.resolve(__dirname, 'api', '[...route].ts'));
          if (typeof routerModule.default === 'function') {
            await routerModule.default(req, res);
          } else {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Router must export a default function' }));
          }
        } catch (err: any) {
          console.error(`[API Dev Error] ${url}:`, err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal Server Error', message: err?.message }));
          }
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiDevPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
});
