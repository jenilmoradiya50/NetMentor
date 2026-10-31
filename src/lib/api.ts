/**
 * Frontend API client with credentials and CSRF mitigation headers.
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  retryAfterSeconds?: number;
  status: number;
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});

  // Add custom header to satisfy server-side CSRF guard
  headers.set('X-NetMentor-Request', '1');

  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
      // Ensure cookies (HttpOnly session) are transmitted
      credentials: 'same-origin',
    });

    let json: any = {};
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { message: text };
      }
    }

    if (!res.ok) {
      return {
        status: res.status,
        error: json.error || 'RequestFailed',
        message: json.message || `Request failed with status ${res.status}`,
        retryAfterSeconds: json.retryAfterSeconds,
      };
    }

    return {
      status: res.status,
      data: json as T,
    };
  } catch (err: any) {
    return {
      status: 0,
      error: 'NetworkError',
      message: err?.message || 'Failed to connect to NetMentor server.',
    };
  }
}

export const authApi = {
  login: (credentials: { username: string; passphrase: string }) =>
    fetchApi<{ success: boolean; role: string; user: string; expiresIn: number }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  logout: () =>
    fetchApi<{ success: boolean; message: string }>('/api/auth/logout', {
      method: 'POST',
    }),

  checkSession: () =>
    fetchApi<{ authenticated: boolean; role: string; user: string; expiresAt: number }>('/api/auth/session', {
      method: 'GET',
    }),

  getPaths: () =>
    fetchApi<{ paths: any[] }>('/api/paths', {
      method: 'GET',
    }),
};

export const flashcardsApi = {
  getCatalog: () =>
    fetchApi<{ totalDecks: number; decks: any[] }>('/api/flashcards/catalog', {
      method: 'GET',
    }),

  getDecks: () =>
    fetchApi<{ decks: any[] }>('/api/flashcards/decks', {
      method: 'GET',
    }),

  getCards: (deckId: string) =>
    fetchApi<{ deck: any; cards: any[]; totalCards: number }>(`/api/flashcards/cards?deckId=${encodeURIComponent(deckId)}`, {
      method: 'GET',
    }),

  preview: (payload: { catalogId?: string; base64Data?: string; filename?: string }) =>
    fetchApi<{ preview: any }>('/api/flashcards/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  importDeck: (payload: { catalogId?: string; base64Data?: string; filename?: string; customTitle?: string }) =>
    fetchApi<{ success: boolean; alreadyImported: boolean; deckId: string; title: string; cardCount: number; message: string; warnings?: string[] }>('/api/flashcards/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteDeck: (deckId: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/flashcards/decks', {
      method: 'DELETE',
      body: JSON.stringify({ id: deckId }),
    }),

  updateProgress: (payload: { cardId: string; deckId: string; status: 'new' | 'learning' | 'review' | 'mastered'; confidenceScore?: number }) =>
    fetchApi<{ success: boolean; progress: any }>('/api/flashcards/progress', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const labsApi = {
  getLabs: () =>
    fetchApi<{ totalLabs: number; softwareRequirement: string; browserExecutionNotice: string; labs: any[] }>('/api/labs', {
      method: 'GET',
    }),
};
