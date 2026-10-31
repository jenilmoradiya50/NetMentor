import type { IncomingMessage, ServerResponse } from 'http';

export interface ApiRequest extends IncomingMessage {
  query?: Record<string, string>;
  body?: any;
  cookies?: Record<string, string>;
}

export interface ApiResponse extends ServerResponse {
  status: (statusCode: number) => ApiResponse;
  json: (data: any) => void;
  setHeader: (name: string, value: string | string[]) => this;
}

export type UserRole = 'admin' | 'user';

export interface SessionPayload {
  sub: string; // username
  role: UserRole;
  iat: number; // Issued at timestamp (seconds)
  exp: number; // Expiration timestamp (seconds)
  jti: string; // Unique token identifier (cryptographic nonce)
}

export interface BruteForceState {
  fails: number;
  lastAttempt: number; // Timestamp (ms)
}
