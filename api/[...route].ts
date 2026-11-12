/**
 * NetMentor Consolidated Vercel Serverless Function Dispatcher - /api/[...route]
 *
 * Central entrypoint routing all incoming /api/* HTTP requests to internal handlers.
 * Resolves the Vercel Hobby 12-function limit by reducing 30 standalone Serverless Functions
 * to 1 catch-all function, while preserving:
 * - 100% of existing /api/* paths and HTTP methods
 * - Request/response streaming, headers, and cookies
 * - Authentication & CSRF guards (requireAuth, validateCsrf)
 * - Dynamic path parameters (:id, :attemptId) and URL query strings
 * - Vercel Fluid Compute execution context & waitUntil() asynchronous execution
 */

import type { ApiRequest, ApiResponse } from './_lib/types.js';
import { redactSecrets } from './_lib/ai/config.js';

// Route Handlers (relocated to internal api/_routes directory)
import healthHandler from './_routes/health.js';
import loginHandler from './_routes/auth/login.js';
import logoutHandler from './_routes/auth/logout.js';
import sessionHandler from './_routes/auth/session.js';
import curriculumProgressHandler from './_routes/curriculum/progress.js';
import cardsHandler from './_routes/flashcards/cards.js';
import catalogHandler from './_routes/flashcards/catalog.js';
import decksHandler from './_routes/flashcards/decks.js';
import importHandler from './_routes/flashcards/import.js';
import lessonDeckHandler from './_routes/flashcards/lesson-deck.js';
import previewHandler from './_routes/flashcards/preview.js';
import flashcardsProgressHandler from './_routes/flashcards/progress.js';
import standaloneDeckHandler from './_routes/flashcards/standalone-deck.js';
import labsHandler from './_routes/labs/index.js';
import generatedLessonsHandler from './_routes/lessons/generated.js';
import pathsHandler from './_routes/paths/index.js';
import quizzesHandler from './_routes/quizzes/index.js';
import quizByIdHandler from './_routes/quizzes/[id].js';
import quizAttemptsHandler from './_routes/quizzes/[id]/attempts.js';
import quizSubmitHandler from './_routes/quizzes/[id]/submit.js';
import attemptDetailHandler from './_routes/quizzes/attempts/[attemptId].js';
import conversationsHandler from './_routes/ai/conversations.js';
import generateFlashcardsHandler from './_routes/ai/generate-flashcards.js';
import generateLessonHandler from './_routes/ai/generate-lesson.js';
import generateQuizHandler from './_routes/ai/generate-quiz.js';
import generateSimulationHandler from './_routes/ai/generate-simulation.js';
import tutorHandler from './_routes/ai/tutor.js';
import getActiveTasksHandler from './_routes/ai/tasks/active.js';
import createTaskHandler from './_routes/ai/tasks/create.js';
import getTaskHandler from './_routes/ai/tasks/[id].js';
import cancelTaskHandler from './_routes/ai/tasks/[id]/cancel.js';

type RouteHandlerFn = (req: ApiRequest, res: ApiResponse) => Promise<any> | any;

interface DynamicRoutePattern {
  regex: RegExp;
  paramNames: string[];
  handler: RouteHandlerFn;
  name: string;
}

// 1. Static Routes (Exact match, evaluated first with O(1) precedence)
export const STATIC_ROUTES: Record<string, RouteHandlerFn> = {
  '/api/health': healthHandler,
  '/api/auth/login': loginHandler,
  '/api/auth/logout': logoutHandler,
  '/api/auth/session': sessionHandler,
  '/api/curriculum/progress': curriculumProgressHandler,
  '/api/flashcards/cards': cardsHandler,
  '/api/flashcards/catalog': catalogHandler,
  '/api/flashcards/decks': decksHandler,
  '/api/flashcards/import': importHandler,
  '/api/flashcards/lesson-deck': lessonDeckHandler,
  '/api/flashcards/preview': previewHandler,
  '/api/flashcards/progress': flashcardsProgressHandler,
  '/api/flashcards/standalone-deck': standaloneDeckHandler,
  '/api/labs': labsHandler,
  '/api/lessons/generated': generatedLessonsHandler,
  '/api/paths': pathsHandler,
  '/api/quizzes': quizzesHandler,
  '/api/ai/conversations': conversationsHandler,
  '/api/ai/generate-flashcards': generateFlashcardsHandler,
  '/api/ai/generate-lesson': generateLessonHandler,
  '/api/ai/generate-quiz': generateQuizHandler,
  '/api/ai/generate-simulation': generateSimulationHandler,
  '/api/generate-simulation': generateSimulationHandler,
  '/api/ai/tutor': tutorHandler,
  '/api/ai/tasks/active': getActiveTasksHandler,
  '/api/ai/tasks/create': createTaskHandler,
};

// 2. Dynamic Routes (Ordered strictly by specificity to prevent shadow collisions)
const DYNAMIC_ROUTES: DynamicRoutePattern[] = [
  // /api/quizzes/attempts/:attemptId -> GET single graded attempt
  {
    regex: /^\/api\/quizzes\/attempts\/([^/]+)$/,
    paramNames: ['attemptId'],
    handler: attemptDetailHandler,
    name: '/api/quizzes/attempts/:attemptId',
  },
  // /api/quizzes/:id/attempts -> GET attempt history for a quiz
  {
    regex: /^\/api\/quizzes\/([^/]+)\/attempts$/,
    paramNames: ['id'],
    handler: quizAttemptsHandler,
    name: '/api/quizzes/:id/attempts',
  },
  // /api/quizzes/:id/submit -> POST quiz submission for grading
  {
    regex: /^\/api\/quizzes\/([^/]+)\/submit$/,
    paramNames: ['id'],
    handler: quizSubmitHandler,
    name: '/api/quizzes/:id/submit',
  },
  // /api/quizzes/:id -> GET, PATCH, DELETE single quiz
  {
    regex: /^\/api\/quizzes\/([^/]+)$/,
    paramNames: ['id'],
    handler: quizByIdHandler,
    name: '/api/quizzes/:id',
  },
  // /api/ai/tasks/:id/cancel -> POST cancel in-flight generation task
  {
    regex: /^\/api\/ai\/tasks\/([^/]+)\/cancel$/,
    paramNames: ['id'],
    handler: cancelTaskHandler,
    name: '/api/ai/tasks/:id/cancel',
  },
  // /api/ai/tasks/:id -> GET status and result of generation task
  {
    regex: /^\/api\/ai\/tasks\/([^/]+)$/,
    paramNames: ['id'],
    handler: getTaskHandler,
    name: '/api/ai/tasks/:id',
  },
];

/**
 * Extracts and normalizes the request pathname from URL string, query, or proxy headers.
 * Resolves both direct requests and Vercel edge rewrite dispatches (via ?__route= parameter).
 */
export function extractPathname(
  rawUrl: string | undefined,
  query?: Record<string, any>,
  headers?: Record<string, any>,
): string {
  // 1. Check if Vercel edge rewrite forwarded the route in query param (__route)
  if (query?.__route && typeof query.__route === 'string') {
    let r = query.__route.trim();
    if (!r.startsWith('/')) r = '/' + r;
    if (!r.startsWith('/api')) r = '/api' + r;
    if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
    return r;
  }

  // 2. Check proxy forwarding headers if present
  const forwardedUri = headers?.['x-forwarded-uri'] || headers?.['x-original-url'];
  if (forwardedUri && typeof forwardedUri === 'string') {
    const qIdx = forwardedUri.indexOf('?');
    let r = (qIdx >= 0 ? forwardedUri.slice(0, qIdx) : forwardedUri).trim();
    if (!r.startsWith('/')) r = '/' + r;
    if (!r.startsWith('/api')) r = '/api' + r;
    if (r.length > 1 && r.endsWith('/')) r = r.slice(0, -1);
    return r;
  }

  // 3. Fallback to rawUrl
  if (!rawUrl) return '';
  const questionIdx = rawUrl.indexOf('?');
  const pathPart = questionIdx >= 0 ? rawUrl.slice(0, questionIdx) : rawUrl;
  let normalized = pathPart.trim();
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized.startsWith('/api') && normalized !== '/') {
    normalized = '/api' + normalized;
  }
  return normalized;
}

/**
 * Parses URL search parameters from raw query string.
 */
export function parseQueryString(rawUrl: string | undefined): Record<string, string> {
  if (!rawUrl) return {};
  const questionIdx = rawUrl.indexOf('?');
  if (questionIdx < 0) return {};
  const searchStr = rawUrl.slice(questionIdx + 1);
  const params = new URLSearchParams(searchStr);
  const query: Record<string, string> = {};
  params.forEach((v, k) => {
    query[k] = v;
  });
  return query;
}

/**
 * Ensures standard status() and json() response helpers exist on ServerResponse.
 */
function ensureResponseHelpers(res: ApiResponse): void {
  if (typeof res.status !== 'function') {
    res.status = function (code: number) {
      this.statusCode = code;
      return this;
    };
  }
  if (typeof res.json !== 'function') {
    res.json = function (data: any) {
      this.setHeader('Content-Type', 'application/json');
      this.end(JSON.stringify(data));
    };
  }
}

/**
 * Matches a pathname to a registered static or dynamic route handler.
 */
export function matchRoute(pathname: string): { handler: RouteHandlerFn; params: Record<string, string>; routeName: string } | null {
  // 1. Check static routes first (O(1))
  if (STATIC_ROUTES[pathname]) {
    return {
      handler: STATIC_ROUTES[pathname],
      params: {},
      routeName: pathname,
    };
  }

  // 2. Check dynamic routes in explicit priority order
  for (const route of DYNAMIC_ROUTES) {
    const match = pathname.match(route.regex);
    if (match) {
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1]);
      });
      return {
        handler: route.handler,
        params,
        routeName: route.name,
      };
    }
  }

  return null;
}

/**
 * Main Serverless Function Entry Point
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  ensureResponseHelpers(res);

  const urlQueryParams = parseQueryString(req.url);
  const combinedQuery = { ...urlQueryParams, ...(req.query || {}) };
  const pathname = extractPathname(req.url, combinedQuery, req.headers);

  // Match route
  const matched = matchRoute(pathname);

  if (!matched) {
    res.status(404).json({
      error: 'Not Found',
      message: `API route ${pathname || req.url} was not found on this server.`,
    });
    return;
  }

  // Merge query parameters without discarding original search params
  const existingQuery = req.query || {};
  req.query = {
    ...urlQueryParams,
    ...existingQuery,
    ...matched.params,
  };
  delete req.query.__route;

  try {
    // Forward original request and response directly to handler
    await matched.handler(req, res);
  } catch (err: any) {
    const safeError = redactSecrets(err?.message || 'Internal Server Error');
    console.error(`[API Router Error] Failure on ${req.method} ${pathname}:`, safeError);

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected server error occurred while processing the request.',
      });
    }
  }
}
