/**
 * Common tool execution wrapper:
 * - Rate limiting check (in-memory token bucket)
 * - Central error boundary (server never crashes, returns structured JSON)
 * - Duration timing and STDERR structured logging
 */

import { performance } from "node:perf_hooks";
import { Logger } from "../lib/logger.js";
import { globalRateLimiter, RateLimitExceededError } from "../lib/rateLimiter.js";
import type { ToolErrorResponse } from "../lib/types.js";

export type ToolResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Creates a safe tool execution handler with rate-limiting, timing, logging, and error isolation.
 */
export function createSafeToolHandler<TArgs>(
  toolName: string,
  handler: (args: TArgs) => Promise<unknown>
): (args: TArgs) => Promise<ToolResponse> {
  return async (args: TArgs): Promise<ToolResponse> => {
    const startTime = performance.now();

    try {
      // 1. Enforce token-bucket rate limiter
      globalRateLimiter.consume("stdio-client");

      // 2. Execute underlying business logic
      const result = await handler(args);

      const durationMs = Math.round(performance.now() - startTime);
      Logger.logToolExecution({
        tool: toolName,
        duration_ms: durationMs,
        success: true,
        args: args as Record<string, unknown>,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);

      let statusCode = "INTERNAL_ERROR";
      let errorMessage = "An unexpected error occurred.";
      let details: unknown = undefined;

      if (err instanceof RateLimitExceededError) {
        statusCode = "RATE_LIMIT_EXCEEDED";
        errorMessage = err.message;
        details = {
          retryAfterSeconds: err.retryAfterSeconds,
          limit: err.limit,
        };
      } else if (err instanceof SchemeNotFoundError) {
        statusCode = "SCHEME_NOT_FOUND";
        errorMessage = err.message;
        details = { scheme_id: err.schemeId };
      } else if (err instanceof ValidationError) {
        statusCode = "VALIDATION_ERROR";
        errorMessage = err.message;
        details = err.details;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      Logger.logToolExecution({
        tool: toolName,
        duration_ms: durationMs,
        success: false,
        error: errorMessage,
        args: args as Record<string, unknown>,
      });

      const errorPayload: ToolErrorResponse = {
        error: {
          code: statusCode,
          message: errorMessage,
          ...(details !== undefined ? { details } : {}),
        },
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(errorPayload, null, 2),
          },
        ],
        isError: true,
      };
    }
  };
}

export class SchemeNotFoundError extends Error {
  public readonly schemeId: string;
  constructor(schemeId: string) {
    super(`Scheme with ID '${schemeId}' was not found.`);
    this.name = "SchemeNotFoundError";
    this.schemeId = schemeId;
  }
}

export class ValidationError extends Error {
  public readonly details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}
