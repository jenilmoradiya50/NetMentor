/**
 * NetMentor AI Tutor API Endpoint - /api/ai/conversations
 * 
 * Manages persistent multi-conversation history:
 * - GET: List user's conversations or load a specific conversation with its messages
 * - POST: Create a new conversation session
 * - PATCH: Rename a conversation
 * - DELETE: Delete a conversation and its messages
 * 
 * Strictly verifies ownership against authenticated user session.
 */

import type { ApiRequest, ApiResponse } from '../_lib/types.js';
import { requireAuth } from '../_lib/auth-guard.js';
import {
  getUserAiConversations,
  getAiConversationWithMessages,
  createAiConversation,
  updateAiConversationTitle,
  deleteAiConversation,
} from '../_lib/db/client.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  // 1. Authenticate user session and enforce CSRF protection
  const session = await requireAuth(req, res);
  if (!session) return;

  const userId = session.userId || session.sub;

  // ---------------------------------------------------------------------------
  // GET: List all conversations or retrieve a specific conversation with messages
  // ---------------------------------------------------------------------------
  if (req.method === 'GET') {
    // Extract optional conversation ID from query or URL
    const url = req.url || '';
    const queryId = (req.query?.id as string) || (url.includes('id=') ? url.split('id=')[1]?.split('&')[0] : undefined);

    if (queryId) {
      const cleanId = decodeURIComponent(queryId).trim();
      try {
        const result = await getAiConversationWithMessages(userId, cleanId);
        if (!result) {
          return res.status(404).json({
            error: 'Not Found',
            message: 'Conversation not found or you do not have permission to view it.',
          });
        }
        return res.status(200).json({
          success: true,
          conversation: result.conversation,
          messages: result.messages,
        });
      } catch (err: any) {
        console.error('[Get Conversation Error]:', err?.message);
        return res.status(500).json({
          error: 'Database Error',
          message: 'Failed to retrieve conversation details.',
        });
      }
    }

    // List all conversations for the authenticated user
    try {
      const conversations = await getUserAiConversations(userId);
      return res.status(200).json({
        success: true,
        conversations,
      });
    } catch (err: any) {
      console.error('[List Conversations Error]:', err?.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to list conversations.',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // POST: Create a new conversation session
  // ---------------------------------------------------------------------------
  if (req.method === 'POST') {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object.',
      });
    }

    const { title, mode, lessonId, sectionId, exerciseId } = req.body;

    const validModes = ['general_qa', 'lesson_qa', 'socratic_hint'];
    const effectiveMode = mode && validModes.includes(String(mode).trim()) ? String(mode).trim() : 'general_qa';
    const cleanTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim().slice(0, 255) : 'New Conversation';

    try {
      const conversation = await createAiConversation(userId, {
        title: cleanTitle,
        mode: effectiveMode,
        lessonId: typeof lessonId === 'string' ? lessonId.trim() : undefined,
        sectionId: typeof sectionId === 'string' ? sectionId.trim() : undefined,
        exerciseId: typeof exerciseId === 'string' ? exerciseId.trim() : undefined,
      });

      return res.status(201).json({
        success: true,
        conversation,
      });
    } catch (err: any) {
      console.error('[Create Conversation Error]:', err?.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to create conversation session.',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // PATCH: Rename a conversation
  // ---------------------------------------------------------------------------
  if (req.method === 'PATCH') {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object.',
      });
    }

    const { id, title } = req.body;

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "id" is required.',
      });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Parameter "title" is required and cannot be blank.',
      });
    }

    try {
      const updated = await updateAiConversationTitle(userId, id.trim(), title.trim());
      if (!updated) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversation not found or you do not have permission to rename it.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Conversation renamed successfully.',
      });
    } catch (err: any) {
      console.error('[Rename Conversation Error]:', err?.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to rename conversation.',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // DELETE: Delete a conversation and all its messages
  // ---------------------------------------------------------------------------
  if (req.method === 'DELETE') {
    const url = req.url || '';
    const bodyId = req.body?.id;
    const queryId = (req.query?.id as string) || (url.includes('id=') ? url.split('id=')[1]?.split('&')[0] : undefined);
    const targetId = bodyId || queryId;

    if (!targetId || typeof targetId !== 'string' || targetId.trim().length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Conversation "id" is required to delete.',
      });
    }

    try {
      const deleted = await deleteAiConversation(userId, targetId.trim());
      if (!deleted) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Conversation not found or you do not have permission to delete it.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Conversation and messages deleted successfully.',
      });
    } catch (err: any) {
      console.error('[Delete Conversation Error]:', err?.message);
      return res.status(500).json({
        error: 'Database Error',
        message: 'Failed to delete conversation.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({
    error: 'Method Not Allowed',
    message: `Method ${req.method} not allowed on /api/ai/conversations`,
  });
}
