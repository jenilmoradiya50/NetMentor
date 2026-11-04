/**
 * NetMentor Background AI Generation Task Status - GET /api/ai/tasks/[id]
 * 
 * Retrieves the status and result of a specific background generation task:
 * 1. Authenticates user and checks CSRF
 * 2. Enforces user ownership (strictly returns 404 if task belongs to another user)
 * 3. Self-heals tasks that have exceeded their execution deadline
 * 4. Parses result data and input parameters into typed JSON objects
 * 5. Returns completed results independently of browser refresh
 */

import type { ApiRequest, ApiResponse } from '../../../_lib/types.js';
import { requireAuth } from '../../../_lib/auth-guard.js';
import { getGenerationTaskById } from '../../../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce GET HTTP Method
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET requests are supported for task inspection.',
    });
  }

  // 2. Authentication
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  // 3. Extract Task ID from Query (or URL Path Fallback)
  let taskId = req.query?.id as string;
  if (!taskId && req.url) {
    const segments = req.url.split('?')[0].split('/').filter(Boolean);
    const lastSeg = segments[segments.length - 1];
    if (lastSeg && lastSeg !== 'tasks' && lastSeg !== 'index') {
      taskId = lastSeg;
    }
  }

  if (!taskId || typeof taskId !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Task ID is required.',
    });
  }

  // 4. Fetch Task by ID (strictly isolated to authenticated user)
  const task = await getGenerationTaskById(userId, taskId);

  if (!task) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Generation task not found or access denied.',
    });
  }

  // 5. Parse JSON Fields for Client Convenience
  let parsedInputParams: any = null;
  if (task.inputParamsJson) {
    try {
      parsedInputParams = typeof task.inputParamsJson === 'string'
        ? JSON.parse(task.inputParamsJson)
        : task.inputParamsJson;
    } catch {
      parsedInputParams = task.inputParamsJson;
    }
  }

  let parsedResultData: any = null;
  if (task.resultDataJson) {
    try {
      parsedResultData = typeof task.resultDataJson === 'string'
        ? JSON.parse(task.resultDataJson)
        : task.resultDataJson;
    } catch {
      parsedResultData = task.resultDataJson;
    }
  }

  return res.status(200).json({
    success: true,
    task: {
      ...task,
      inputParams: parsedInputParams,
      resultData: parsedResultData,
    },
  });
}
