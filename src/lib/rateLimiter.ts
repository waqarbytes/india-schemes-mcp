/**
 * In-Memory Token Bucket Rate Limiter
 * Limits incoming tool requests (default ~30 requests/minute per client).
 */

export interface RateLimiterOptions {
  capacity?: number;       // Maximum burst tokens in bucket (default: 30)
  refillRatePerMinute?: number; // Refill tokens per minute (default: 30)
}

interface BucketState {
  tokens: number;
  lastRefillTimestamp: number;
}

export class RateLimitExceededError extends Error {
  public readonly retryAfterSeconds: number;
  public readonly limit: number;

  constructor(message: string, retryAfterSeconds: number, limit: number) {
    super(message);
    this.name = "RateLimitExceededError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.limit = limit;
  }
}

export class TokenBucketRateLimiter {
  private readonly capacity: number;
  private readonly refillRatePerMs: number;
  private readonly buckets: Map<string, BucketState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: RateLimiterOptions = {}) {
    this.capacity = options.capacity ?? 30;
    const refillPerMinute = options.refillRatePerMinute ?? 30;
    this.refillRatePerMs = refillPerMinute / 60000;

    // Periodically clean up idle buckets older than 10 minutes to prevent memory leaks
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        for (const [key, state] of this.buckets.entries()) {
          if (now - state.lastRefillTimestamp > tenMinutes) {
            this.buckets.delete(key);
          }
        }
      }, 5 * 60 * 1000);
      // Unref to not prevent Node.js process from exiting cleanly
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  private getBucket(clientId: string, now: number): BucketState {
    let state = this.buckets.get(clientId);
    if (!state) {
      state = {
        tokens: this.capacity,
        lastRefillTimestamp: now,
      };
      this.buckets.set(clientId, state);
    } else {
      const elapsed = now - state.lastRefillTimestamp;
      const tokensToAdd = elapsed * this.refillRatePerMs;
      state.tokens = Math.min(this.capacity, state.tokens + tokensToAdd);
      state.lastRefillTimestamp = now;
    }
    return state;
  }

  /**
   * Attempt to consume tokens for a given client with input validation.
   */
  public tryConsume(
    clientId = "stdio-client",
    tokensToConsume = 1
  ): { allowed: boolean; remaining: number; resetInMs: number } {
    // Sanitize and bound tokensToConsume
    const sanitizedCost =
      Number.isFinite(tokensToConsume) && tokensToConsume > 0
        ? Math.min(Math.floor(tokensToConsume), this.capacity)
        : 1;

    // Sanitize client key
    const safeClientId =
      typeof clientId === "string" && clientId.length > 0 && clientId.length <= 128
        ? clientId.replace(/[^a-zA-Z0-9_\-.:]/g, "_")
        : "stdio-client";

    const now = Date.now();
    const state = this.getBucket(safeClientId, now);

    if (state.tokens >= sanitizedCost) {
      state.tokens -= sanitizedCost;
      return {
        allowed: true,
        remaining: Math.max(0, Math.floor(state.tokens)),
        resetInMs: 0,
      };
    }

    const missingTokens = sanitizedCost - state.tokens;
    const resetInMs = Math.ceil(missingTokens / this.refillRatePerMs);

    return {
      allowed: false,
      remaining: Math.max(0, Math.floor(state.tokens)),
      resetInMs: Math.max(0, resetInMs),
    };
  }


  /**
   * Consume tokens or throw a structured RateLimitExceededError.
   */
  public consume(clientId = "stdio-client", tokensToConsume = 1): void {
    const result = this.tryConsume(clientId, tokensToConsume);
    if (!result.allowed) {
      const retrySec = Math.max(1, Math.ceil(result.resetInMs / 1000));
      throw new RateLimitExceededError(
        `Rate limit exceeded: Max ${this.capacity} requests per minute allowed. Please wait ${retrySec}s before retrying.`,
        retrySec,
        this.capacity
      );
    }
  }

  /**
   * Reset bucket for a client (useful in unit tests).
   */
  public reset(clientId?: string): void {
    if (clientId) {
      this.buckets.delete(clientId);
    } else {
      this.buckets.clear();
    }
  }

  public getActiveBucketCount(): number {
    return this.buckets.size;
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global default rate limiter instance
export const globalRateLimiter = new TokenBucketRateLimiter();
