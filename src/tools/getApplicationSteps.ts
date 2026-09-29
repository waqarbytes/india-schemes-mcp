/**
 * Tool: get_application_steps
 * Provides ordered, step-by-step application instructions and direct official portal URL.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSchemeRepository } from "../lib/repository.js";
import type { ApplicationStepsResult } from "../lib/types.js";
import { createSafeToolHandler, SchemeNotFoundError } from "./common.js";

export const getApplicationStepsSchema = {
  scheme_id: z
    .string()
    .min(1, "Scheme ID cannot be empty")
    .max(100)
    .describe("The unique ID of the scheme (e.g., 'pm-kisan', 'pm-svanidhi', 'pm-vishwakarma')"),
};

export function registerGetApplicationStepsTool(server: McpServer): void {
  server.registerTool(
    "get_application_steps",
    {
      title: "Get Application Steps",
      description:
        "Retrieve sequential, ordered application instructions and verified official portal links for any government scheme.",
      inputSchema: getApplicationStepsSchema,
    },
    createSafeToolHandler("get_application_steps", async (args: z.infer<z.ZodObject<typeof getApplicationStepsSchema>>) => {
      const repo = getSchemeRepository();
      const scheme = await repo.getById(args.scheme_id);

      if (!scheme) {
        throw new SchemeNotFoundError(args.scheme_id);
      }

      const result: ApplicationStepsResult = {
        scheme_id: scheme.id,
        scheme_name: scheme.name,
        steps: scheme.application_steps,
        official_url: scheme.official_url,
        is_sample: scheme.is_sample,
      };

      return {
        application_guide: result,
      };
    })
  );
}
