import { describe, it, expect, beforeEach } from "vitest";
import {
  TokenBucketRateLimiter,
  RateLimitExceededError,
} from "../src/lib/rateLimiter.js";

describe("TokenBucketRateLimiter", () => {
  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    // 5 tokens capacity, 60 tokens per minute (1 token per second)
    limiter = new TokenBucketRateLimiter({
      capacity: 5,
      refillRatePerMinute: 60,
    });
  });

  it("should allow consumption within capacity limit", () => {
    for (let i = 0; i < 5; i++) {
      const res = limiter.tryConsume("client-1");
      expect(res.allowed).toBe(true);
    }
  });

  it("should reject consumption once capacity is exhausted", () => {
    for (let i = 0; i < 5; i++) {
      limiter.tryConsume("client-2");
    }

    const failedAttempt = limiter.tryConsume("client-2");
    expect(failedAttempt.allowed).toBe(false);
    expect(failedAttempt.remaining).toBe(0);
    expect(failedAttempt.resetInMs).toBeGreaterThan(0);
  });

  it("should throw RateLimitExceededError when using consume()", () => {
    for (let i = 0; i < 5; i++) {
      limiter.consume("client-3");
    }

    expect(() => limiter.consume("client-3")).toThrowError(RateLimitExceededError);
  });

  it("should isolate rate limits across different clients", () => {
    for (let i = 0; i < 5; i++) {
      limiter.consume("client-A");
    }

    // Client A is exhausted, but Client B should still be allowed
    expect(() => limiter.consume("client-A")).toThrow();
    expect(limiter.tryConsume("client-B").allowed).toBe(true);
  });

  it("should reset client tokens on reset()", () => {
    for (let i = 0; i < 5; i++) {
      limiter.consume("client-reset");
    }

    expect(limiter.tryConsume("client-reset").allowed).toBe(false);
    limiter.reset("client-reset");
    expect(limiter.tryConsume("client-reset").allowed).toBe(true);
  });

  it("should safely sanitize invalid or negative tokensToConsume arguments", () => {
    // Negative or NaN cost should be clamped safely to 1 and not grant free bypass
    const resNegative = limiter.tryConsume("client-tamper", -10);
    expect(resNegative.allowed).toBe(true);
    expect(resNegative.remaining).toBe(4);

    const resNaN = limiter.tryConsume("client-tamper", NaN);
    expect(resNaN.allowed).toBe(true);
    expect(resNaN.remaining).toBe(3);
  });
});

