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

        // Map URL path to file in api directory
        const apiPath = url.replace(/^\/api\/?/, '');
        const segments = apiPath.split('/').filter(Boolean);

        // Files or folders starting with an underscore are ignored from routing
        if (segments.some((seg) => seg.startsWith('_'))) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not Found', message: `Internal module not accessible` }));
          return;
        }

        const dynamicParams: Record<string, string> = {};
        let targetFile: string | null = null;

        // Try direct file or index.ts first
        const directFile = path.resolve(__dirname, 'api', ...segments) + '.ts';
        const directIndex = path.resolve(__dirname, 'api', ...segments, 'index.ts');
        if (fs.existsSync(directFile)) {
          targetFile = directFile;
        } else if (fs.existsSync(directIndex)) {
          targetFile = directIndex;
        } else {
          // Dynamic route matching for [param] folders or files
          let currentDir = path.resolve(__dirname, 'api');
          for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const isLast = i === segments.length - 1;

            if (isLast) {
              const f = path.resolve(currentDir, seg + '.ts');
              const idx = path.resolve(currentDir, seg, 'index.ts');
              if (fs.existsSync(f)) {
                targetFile = f;
                break;
              }
              if (fs.existsSync(idx)) {
                targetFile = idx;
                break;
              }
              if (fs.existsSync(currentDir)) {
                const entries = fs.readdirSync(currentDir);
                const dynamicEntry = entries.find((e) => e.startsWith('[') && e.endsWith('].ts'));
                if (dynamicEntry) {
                  const match = dynamicEntry.match(/^\[([^\]]+)\]\.ts$/);
                  const paramName = match ? match[1] : dynamicEntry.slice(1, -4);
                  dynamicParams[paramName] = seg;
                  targetFile = path.resolve(currentDir, dynamicEntry);
                  break;
                }
              }
            } else {
              const directDir = path.resolve(currentDir, seg);
              if (fs.existsSync(directDir) && fs.statSync(directDir).isDirectory()) {
                currentDir = directDir;
              } else if (fs.existsSync(currentDir)) {
                const entries = fs.readdirSync(currentDir);
                const dynamicDir = entries.find(
                  (e) => e.startsWith('[') && e.endsWith(']') && fs.statSync(path.resolve(currentDir, e)).isDirectory()
                );
                if (dynamicDir) {
                  const match = dynamicDir.match(/^\[([^\]]+)\]$/);
                  const paramName = match ? match[1] : dynamicDir.slice(1, -1);
                  dynamicParams[paramName] = seg;
                  currentDir = path.resolve(currentDir, dynamicDir);
                } else {
                  break;
                }
              } else {
                break;
              }
            }
          }
        }

        if (!targetFile || !fs.existsSync(targetFile)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Not Found', message: `API route ${url} not found` }));
          return;
        }

        // Parse JSON body for mutation requests
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

        // Parse query params
        const searchStr = (req.url || '').split('?')[1];
        const query: Record<string, string> = {};
        if (searchStr) {
          const params = new URLSearchParams(searchStr);
          params.forEach((v, k) => {
            query[k] = v;
          });
        }

        // Augment req object
        Object.assign(query, dynamicParams);
        (req as any).body = body;
        (req as any).query = query;

        // Augment res object with Express/Vercel-like helpers
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
          // Dynamically load and execute the TypeScript API route
          const mod = await server.ssrLoadModule(targetFile);
          if (typeof mod.default === 'function') {
            await mod.default(req, res);
          } else {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Handler must export a default function' }));
          }
        } catch (err: any) {
          console.error(`[API Dev Error] ${url}:`, err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Server Error', message: err?.message }));
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
