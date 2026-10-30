export interface CookieOptions {
  maxAge?: number; // seconds
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
}

/**
 * Parses raw Cookie header into key-value pairs
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  const pairs = cookieHeader.split(';');

  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;

    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();

    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }

  return cookies;
}

/**
 * Serializes a cookie name/value pair with standard security options
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts: string[] = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  const path = options.path ?? '/';
  parts.push(`Path=${path}`);

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  } else if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const secure = options.secure !== undefined ? options.secure : isProduction;
  if (secure) {
    parts.push('Secure');
  }

  const sameSite = options.sameSite ?? 'Strict';
  parts.push(`SameSite=${sameSite}`);

  return parts.join('; ');
}

/**
 * Generates an expired cookie header to invalidate existing sessions
 */
export function serializeExpiredCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, '', {
    ...options,
    expires: new Date(0),
    maxAge: 0,
  });
}
