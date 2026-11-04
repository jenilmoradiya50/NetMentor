import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { query } from '../_lib/db/client.js';

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

    // Read-only schema readiness verification (does not modify database)
    let schemaReady = false;
    try {
      const checkRes = await query(`
        SELECT 
          current_database() as db_name,
          current_setting('neon.endpoint_id', true) as ep_id,
          EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
          ) as has_users,
          EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
          ) as has_migrations;
      `);
      const row = checkRes?.rows[0];
      schemaReady = Boolean(row?.has_users && row?.has_migrations);
      console.log(`[Health Diagnostic]: db=${row?.db_name}, ep=${row?.ep_id}, has_users=${row?.has_users}, has_migrations=${row?.has_migrations}`);
    } catch (err: any) {
      console.error('[Health Diagnostic Error]:', err?.message);
    }

    return res.status(200).json({
      connected: true,
      engine: 'Neon / PostgreSQL',
      latencyMs: latencyMs >= 0 ? latencyMs : 0,
      schemaReady,
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
