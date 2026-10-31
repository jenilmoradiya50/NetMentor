import type { ApiRequest, ApiResponse } from './_lib/types.js';
import { query } from './_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Only accept GET requests
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET is supported.',
    });
  }

  // Prevent caching of health status
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const startTime = performance.now();

  try {
    // Lightweight database connectivity check
    await query('SELECT 1;');
    const latencyMs = Math.round(performance.now() - startTime);

    return res.status(200).json({
      connected: true,
      engine: 'Neon / PostgreSQL',
      latencyMs: latencyMs >= 0 ? latencyMs : 0,
    });
  } catch (err: any) {
    // Log sanitized diagnostic server-side without leaking connection strings or credentials
    console.error('[Health Check Error]: Database query failed.');

    return res.status(503).json({
      connected: false,
      engine: 'Neon / PostgreSQL',
      latencyMs: -1,
    });
  }
}
