/**
 * Tool Registry
 * Aggregates and registers all 6 MCP tools with the McpServer instance.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchSchemesTool } from "./searchSchemes.js";
import { registerGetSchemeTool } from "./getScheme.js";
import { registerCheckEligibilityTool } from "./checkEligibility.js";
import { registerGetDeadlineTool } from "./getDeadline.js";
import { registerCompareSchemesTool } from "./compareSchemes.js";
import { registerGetApplicationStepsTool } from "./getApplicationSteps.js";

export function registerAllTools(server: McpServer): void {
  registerSearchSchemesTool(server);
  registerGetSchemeTool(server);
  registerCheckEligibilityTool(server);
  registerGetDeadlineTool(server);
  registerCompareSchemesTool(server);
  registerGetApplicationStepsTool(server);
}
