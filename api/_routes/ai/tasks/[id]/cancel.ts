/**
 * NetMentor Background AI Generation Task Cancellation - POST /api/ai/tasks/[id]/cancel
 * 
 * Cancels an active in-flight or queued AI generation task:
 * 1. Authenticates user and checks CSRF
 * 2. Enforces user ownership (404 if not found or belongs to another user)
 * 3. Prevents cancellation of already completed or failed tasks (409 Conflict)
 * 4. Atomically transitions status to 'cancelled' in Neon PostgreSQL
 * 5. Guarantees task can never become completed after cancellation
 */

import type { ApiRequest, ApiResponse } from '../../../../_lib/types.js';
import { requireAuth } from '../../../../_lib/auth-guard.js';
import {
  getGenerationTaskById,
  cancelGenerationTask,
} from '../../../../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Enforce POST HTTP Method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are supported for task cancellation.',
    });
  }

  // 2. Authentication & CSRF
  const session = await requireAuth(req, res);
  if (!session) {
    return;
  }
  const userId = session.userId || session.sub;

  // 3. Extract Task ID from Query (or URL Path Fallback)
  let taskId = req.query?.id as string;
  if (!taskId && req.url) {
    const segments = req.url.split('?')[0].split('/').filter(Boolean);
    // Path: /api/ai/tasks/[id]/cancel -> segments = ['api', 'ai', 'tasks', '<id>', 'cancel']
    const cancelIdx = segments.indexOf('cancel');
    if (cancelIdx > 0) {
      taskId = segments[cancelIdx - 1];
    } else {
      const lastSeg = segments[segments.length - 1];
      if (lastSeg && lastSeg !== 'cancel' && lastSeg !== 'tasks') {
        taskId = lastSeg;
      }
    }
  }

  if (!taskId || typeof taskId !== 'string') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Task ID is required for cancellation.',
    });
  }

  // 4. Fetch Task & Enforce Ownership
  const task = await getGenerationTaskById(userId, taskId);

  if (!task) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Generation task not found or access denied.',
    });
  }

  // 5. Check Terminal States
  if (task.status === 'cancelled') {
    return res.status(200).json({
      success: true,
      message: 'Task is already cancelled.',
      task,
    });
  }

  if (task.status === 'completed' || task.status === 'failed') {
    return res.status(409).json({
      error: 'Conflict',
      message: `Task cannot be cancelled because it is already ${task.status}.`,
      status: task.status,
    });
  }

  // 6. Perform Atomic Cancellation in Database
  const cancelled = await cancelGenerationTask(userId, taskId);

  if (!cancelled) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'Failed to cancel task. It may have completed immediately before cancellation.',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Generation task cancelled successfully.',
    taskId,
  });
}
