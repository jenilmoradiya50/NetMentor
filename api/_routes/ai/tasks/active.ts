/**
 * NetMentor Active Background AI Generation Tasks - GET /api/ai/tasks/active
 * 
 * Retrieves all currently active (queued or processing) generation tasks for
 * the authenticated user:
 * 1. Authenticates user and checks session
 * 2. Self-heals any expired tasks in the database
 * 3. Enforces strict multi-tenant isolation
 * 4. Parses input parameters and result payloads for immediate frontend consumption
 * 5. Enables seamless task recovery across browser refresh and page navigation
 */

import type { ApiRequest, ApiResponse } from '../../../_lib/types.js';
import { requireAuth } from '../../../_lib/auth-guard.js';
import { getUserActiveGenerationTasks } from '../../../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce GET HTTP Method
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET requests are supported for active task inspection.',
    });
  }

  // 2. Authentication
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  // 3. Retrieve Active Generation Tasks (Strictly filtered by userId)
  const activeTasks = await getUserActiveGenerationTasks(userId);

  // 4. Parse JSON fields for client convenience
  const formattedTasks = activeTasks.map((t) => {
    let parsedInputParams: any = null;
    if (t.inputParamsJson) {
      try {
        parsedInputParams = typeof t.inputParamsJson === 'string'
          ? JSON.parse(t.inputParamsJson)
          : t.inputParamsJson;
      } catch {
        parsedInputParams = t.inputParamsJson;
      }
    }

    let parsedResultData: any = null;
    if (t.resultDataJson) {
      try {
        parsedResultData = typeof t.resultDataJson === 'string'
          ? JSON.parse(t.resultDataJson)
          : t.resultDataJson;
      } catch {
        parsedResultData = t.resultDataJson;
      }
    }

    return {
      ...t,
      inputParams: parsedInputParams,
      resultData: parsedResultData,
    };
  });

  return res.status(200).json({
    success: true,
    tasks: formattedTasks,
    count: formattedTasks.length,
  });
}
