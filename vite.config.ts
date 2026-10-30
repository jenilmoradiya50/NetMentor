import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Lightweight Vite plugin to emulate Vercel Serverless Functions in local development.
 * Automatically intercepts `/api/*` requests, loads the corresponding TypeScript handler,
 * and executes it with incoming request/response helpers.
 * Note: Paths prefixed with an underscore (e.g. `_lib/`) are ignored, matching Vercel's convention.
 */
function vercelApiDevPlugin(): Plugin {
  return {
    name: 'vercel-api-dev',
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

        let targetFile = path.resolve(__dirname, 'api', ...segments) + '.ts';
        if (!fs.existsSync(targetFile)) {
          targetFile = path.resolve(__dirname, 'api', ...segments, 'index.ts');
        }

        if (!fs.existsSync(targetFile)) {
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

        // Augment req object
        (req as any).body = body;

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
    port: 3000,
    open: false,
  },
});
