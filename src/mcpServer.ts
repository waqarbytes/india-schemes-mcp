/**
 * India Schemes MCP Server definition
 * Configures the MCP server instance and registers all domain tools.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import { Logger } from "./lib/logger.js";

export function createIndiaSchemesServer(): McpServer {
  Logger.info("Initializing india-schemes-mcp server v1.0.0");

  const server = new McpServer(
    {
      name: "india-schemes-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register all 6 scheme tools
  registerAllTools(server);

  return server;
}
