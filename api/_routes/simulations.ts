/**
 * NetMentor Protocol Simulations API Endpoint - /api/simulations
 *
 * Supports CRUD operations for user-saved AI protocol simulations:
 * - GET: List saved simulations or retrieve a single simulation by ID / scenario ID
 * - POST: Validate and persist/upsert a simulation scenario to Neon PostgreSQL
 * - DELETE: Delete a saved simulation with strict user ownership enforcement
 */

import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth, validateCsrf } from '../_lib/auth-guard.js';
import {
  saveCustomSimulation,
  listSavedSimulations,
  getSavedSimulationById,
  deleteSavedSimulation,
  markSimulationCompleted,
  listSimulationCompletions,
} from '../_lib/db/client.js';
import { validateSimulationScenario } from '../_lib/ai/simulation-validator.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // Demo Mode check: Header or query parameter
  const isDemoMode =
    req.headers['x-netmentor-demo'] === 'true' ||
    req.query?.demo === 'true';

  const method = req.method?.toUpperCase();

  // If in demo mode and unauthenticated, handle in demo mode
  if (isDemoMode) {
    return handleDemoMode(req, res, method);
  }

  // 1. Authenticate user
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  switch (method) {
    case 'GET':
      return handleGet(req, res, userId);
    case 'POST':
      return handlePost(req, res, userId);
    case 'DELETE':
      return handleDelete(req, res, userId);
    default:
      res.setHeader('Allow', 'GET, POST, DELETE');
      return res.status(405).json({
        error: 'Method Not Allowed',
        message: `HTTP method ${method} is not supported on this endpoint.`,
      });
  }
}

/**
 * Demo mode fallback handler for unauthenticated users exploring in demo mode
 */
function handleDemoMode(req: ApiRequest, res: ApiResponse, method?: string) {
  const resource = typeof req.query?.resource === 'string' ? req.query.resource.trim() : undefined;

  if (method === 'GET') {
    if (resource === 'completions') {
      return res.status(200).json({
        success: true,
        completions: [],
        count: 0,
        isDemoMode: true,
      });
    }

    return res.status(200).json({
      success: true,
      simulations: [],
      count: 0,
      isDemoMode: true,
    });
  }

  if (method === 'POST') {
    if (!validateCsrf(req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'CSRF validation failed.',
      });
    }

    if (req.body?.action === 'complete') {
      const scenarioId = typeof req.body?.scenarioId === 'string' ? req.body.scenarioId.trim() : '';
      if (!scenarioId) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing scenarioId for completion record.',
        });
      }

      return res.status(201).json({
        success: true,
        completion: {
          id: `demo-comp-${Date.now()}`,
          userId: 'demo-user',
          scenarioId,
          protocol: req.body?.protocol || 'OSPF',
          certification: req.body?.certification || 'CCNA',
          completedAt: new Date().toISOString(),
        },
        isDemoMode: true,
      });
    }

    const rawScenario = req.body?.scenario || req.body;
    const validation = validateSimulationScenario(rawScenario);
    if (!validation.valid || !validation.scenario) {
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'Simulation scenario structure failed schema validation.',
        errors: validation.errors || [],
      });
    }

    const sim = validation.scenario;
    return res.status(201).json({
      success: true,
      simulation: {
        id: `demo-${Date.now()}`,
        userId: 'demo-user',
        scenarioId: sim.metadata.id,
        title: sim.metadata.title,
        protocol: sim.metadata.protocol,
        certification: sim.metadata.certification,
        difficulty: sim.metadata.difficulty,
        scenario: sim,
        createdAt: new Date().toISOString(),
      },
      isDemoMode: true,
    });
  }

  if (method === 'DELETE') {
    if (!validateCsrf(req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'CSRF validation failed.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Simulation deleted from demo storage.',
      isDemoMode: true,
    });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({
    error: 'Method Not Allowed',
    message: `HTTP method ${method} is not supported on this endpoint.`,
  });
}

/**
 * GET: Retrieve user's saved simulations or single simulation by ID
 */
async function handleGet(req: ApiRequest, res: ApiResponse, userId: string) {
  let simId = typeof req.query?.id === 'string' ? req.query.id.trim() : undefined;
  let resource = typeof req.query?.resource === 'string' ? req.query.resource.trim() : undefined;
  if (req.url && req.url.includes('?')) {
    try {
      const searchParams = new URL(req.url, 'http://localhost').searchParams;
      if (!simId) simId = searchParams.get('id')?.trim() || undefined;
      if (!resource) resource = searchParams.get('resource')?.trim() || undefined;
    } catch {}
  }

  try {
    if (resource === 'completions') {
      const completions = await listSimulationCompletions(userId);
      return res.status(200).json({
        success: true,
        completions,
        count: completions.length,
      });
    }

    if (simId) {
      const simulation = await getSavedSimulationById(userId, simId);
      if (!simulation) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Saved simulation scenario not found or access denied.',
        });
      }
      return res.status(200).json({
        success: true,
        simulation,
      });
    }

    const simulations = await listSavedSimulations(userId);
    return res.status(200).json({
      success: true,
      simulations,
      count: simulations.length,
    });
  } catch (err: any) {
    console.error('[Get Saved Simulations Error]:', err?.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve saved simulations from database.',
    });
  }
}

/**
 * POST: Validate and persist a simulation scenario or lab completion
 */
async function handlePost(req: ApiRequest, res: ApiResponse, userId: string) {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body must be a valid JSON object.',
    });
  }

  // 1. Handle lab completion tracking
  if ((req.body as any).action === 'complete') {
    if (!validateCsrf(req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'CSRF validation failed.',
      });
    }

    const scenarioId = typeof (req.body as any).scenarioId === 'string' ? (req.body as any).scenarioId.trim() : '';
    if (!scenarioId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing scenarioId in request body.',
      });
    }

    const protocol = typeof (req.body as any).protocol === 'string' ? (req.body as any).protocol.trim() : 'OSPF';
    const certification = typeof (req.body as any).certification === 'string' ? (req.body as any).certification.trim() : 'CCNA';

    try {
      const completion = await markSimulationCompleted(userId, scenarioId, protocol, certification);
      return res.status(201).json({
        success: true,
        completion,
      });
    } catch (err: any) {
      console.error('[Mark Simulation Completed Error]:', err?.message);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to record simulation completion in database.',
      });
    }
  }

  const rawScenario = (req.body as any).scenario || req.body;
  if (!rawScenario || typeof rawScenario !== 'object') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing scenario definition in request body.',
    });
  }

  // Validate the scenario schema before saving to prevent corrupting database
  const validation = validateSimulationScenario(rawScenario);
  if (!validation.valid || !validation.scenario) {
    return res.status(422).json({
      error: 'Unprocessable Entity',
      message: 'Simulation scenario structure failed schema validation.',
      errors: validation.errors || [],
    });
  }

  try {
    const saved = await saveCustomSimulation(userId, validation.scenario);
    return res.status(201).json({
      success: true,
      simulation: saved,
      scenarioId: saved.scenarioId,
    });
  } catch (err: any) {
    console.error('[Save Simulation Error]:', err?.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to persist simulation scenario to database.',
    });
  }
}

/**
 * DELETE: Delete a saved simulation owned by the user
 */
async function handleDelete(req: ApiRequest, res: ApiResponse, userId: string) {
  const idFromQuery = typeof req.query?.id === 'string' ? req.query.id.trim() : undefined;
  const idFromBody =
    req.body && typeof req.body === 'object' && typeof (req.body as any).id === 'string'
      ? (req.body as any).id.trim()
      : undefined;
  const scenarioIdFromBody =
    req.body && typeof req.body === 'object' && typeof (req.body as any).scenarioId === 'string'
      ? (req.body as any).scenarioId.trim()
      : undefined;

  const simId = idFromQuery || idFromBody || scenarioIdFromBody;

  if (!simId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Simulation ID must be provided via query parameter (?id=...) or request body.',
    });
  }

  try {
    const deleted = await deleteSavedSimulation(userId, simId);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Saved simulation not found or access denied.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Saved simulation deleted successfully.',
    });
  } catch (err: any) {
    console.error('[Delete Simulation Error]:', err?.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete simulation from database.',
    });
  }
}
