/**
 * NetMentor AI Tutor Engine - Server-Side Rate Limiter
 * 
 * Provides conservative per-user request throttling to protect compute resources
 * and prevent abuse.
 * 
 * ARCHITECTURAL NOTE & SERVERLESS LIMITATIONS:
 * This implementation is an in-memory sliding-window limiter bounded per serverless
 * worker instance. In multi-instance or ephemeral serverless deployments where workers
 * are scaled across regions, memory is not shared across isolated microVMs; each warm
 * instance maintains its own memory bucket.
 * 
 * While this provides a robust defense against rapid single-client hammering on warm
 * instances, it is NOT a globally unified cluster limiter. For production distributed
 * environments requiring strict global coordination, this class implements the
 * `RateLimiter` interface and can be dropped-in replaced with Upstash Redis, AWS ElastiCache,
 * or Neon KV store without changing the API endpoint logic.
 * 
 * No database tables or schema migrations are introduced in this milestone.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number; // Timestamp in milliseconds
}

export interface RateLimiter {
  check(userId: string): RateLimitResult;
  reset(userId?: string): void;
}

interface UserRateRecord {
  timestamps: number[];
  lastSeen: number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxTrackedUsers: number;
  private readonly userBuckets: Map<string, UserRateRecord>;

  /**
   * @param maxRequests Maximum allowed requests within the time window (default 20)
   * @param windowMs Time window in milliseconds (default 1 hour = 3,600,000 ms)
   * @param maxTrackedUsers Maximum active users stored in memory to prevent memory leaks (default 5,000)
   */
  constructor(
    maxRequests: number = 20,
    windowMs: number = 60 * 60 * 1000,
    maxTrackedUsers: number = 5000
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxTrackedUsers = maxTrackedUsers;
    this.userBuckets = new Map();
  }

  /**
   * Checks whether an authenticated user is permitted to make an AI request.
   * If permitted, records the timestamp and returns the remaining quota.
   * If quota is exceeded, returns allowed=false with the retry-after duration in seconds.
   */
  public check(userId: string): RateLimitResult {
    if (!userId || typeof userId !== 'string') {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 60,
        resetAt: Date.now() + 60000,
      };
    }

    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Prune stale records if memory limit is approached
    if (this.userBuckets.size >= this.maxTrackedUsers) {
      this.pruneStaleUsers(windowStart);
      // If still at capacity after pruning, evict the oldest user
      if (this.userBuckets.size >= this.maxTrackedUsers) {
        const oldestKey = this.userBuckets.keys().next().value;
        if (oldestKey) {
          this.userBuckets.delete(oldestKey);
        }
      }
    }

    let record = this.userBuckets.get(userId);

    if (!record) {
      record = {
        timestamps: [now],
        lastSeen: now,
      };
      this.userBuckets.set(userId, record);

      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        retryAfterSeconds: 0,
        resetAt: now + this.windowMs,
      };
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((t) => t > windowStart);
    record.lastSeen = now;

    if (record.timestamps.length >= this.maxRequests) {
      const oldestInWindow = record.timestamps[0];
      const resetAt = oldestInWindow + this.windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        resetAt,
      };
    }

    record.timestamps.push(now);

    const oldestInWindow = record.timestamps[0] || now;
    const resetAt = oldestInWindow + this.windowMs;

    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      retryAfterSeconds: 0,
      resetAt,
    };
  }

  /**
   * Cleans up expired user buckets to keep memory usage strictly bounded.
   */
  private pruneStaleUsers(windowStart: number): void {
    for (const [uid, rec] of this.userBuckets.entries()) {
      if (rec.lastSeen <= windowStart) {
        this.userBuckets.delete(uid);
      }
    }
  }

  /**
   * Resets rate-limit history for a single user or all users (useful for test suites).
   */
  public reset(userId?: string): void {
    if (userId) {
      this.userBuckets.delete(userId);
    } else {
      this.userBuckets.clear();
    }
  }

  /**
   * Returns current count of tracked users (for diagnostics and testing).
   */
  public getTrackedUserCount(): number {
    return this.userBuckets.size;
  }
}

/**
 * Standard singleton rate limiter: 20 requests per hour per user.
 */
export const tutorRateLimiter = new InMemoryRateLimiter(20, 60 * 60 * 1000);
