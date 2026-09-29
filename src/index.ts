#!/usr/bin/env node

/**
 * Entry point for india-schemes-mcp server.
 * Connects the server to StdioServerTransport and handles lifecycle & shutdown.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createIndiaSchemesServer } from "./mcpServer.js";
import { Logger } from "./lib/logger.js";
import { globalRateLimiter } from "./lib/rateLimiter.js";

async function main(): Promise<void> {
  const server = createIndiaSchemesServer();
  const transport = new StdioServerTransport();

  // Register graceful shutdown handlers
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    Logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    try {
      globalRateLimiter.destroy();
      await server.close();
      Logger.info("india-schemes-mcp server shut down cleanly.");
      process.exit(0);
    } catch (err) {
      Logger.error("Error during server shutdown", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => {
    void handleShutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void handleShutdown("SIGTERM");
  });

  process.on("uncaughtException", (error: Error) => {
    Logger.error("Uncaught exception caught in process boundary", {
      error: error.message,
      stack: error.stack,
    });
  });

  process.on("unhandledRejection", (reason: unknown) => {
    Logger.error("Unhandled promise rejection caught in process boundary", {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  // Connect the MCP server to stdio transport
  try {
    await server.connect(transport);
    Logger.info("india-schemes-mcp is running on stdio transport");
  } catch (error) {
    Logger.error("Failed to start india-schemes-mcp server", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

void main();
