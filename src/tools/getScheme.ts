/**
 * Tool: get_scheme
 * Retrieves comprehensive details for a specific scheme by ID.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSchemeRepository } from "../lib/repository.js";
import { createSafeToolHandler, SchemeNotFoundError } from "./common.js";

export const getSchemeSchema = {
  scheme_id: z
    .string()
    .min(1, "Scheme ID cannot be empty")
    .max(100, "Scheme ID is too long")
    .describe("The unique identifier of the scheme (e.g., 'pm-kisan', 'atal-pension-yojana', 'pm-jay-ayushman')"),
};

export function registerGetSchemeTool(server: McpServer): void {
  server.registerTool(
    "get_scheme",
    {
      title: "Get Scheme Details",
      description:
        "Fetch complete details of a specific Indian government scheme by its unique ID, including eligibility rules, benefits, deadlines, and application links.",
      inputSchema: getSchemeSchema,
    },
    createSafeToolHandler("get_scheme", async (args: z.infer<z.ZodObject<typeof getSchemeSchema>>) => {
      const repo = getSchemeRepository();
      const scheme = await repo.getById(args.scheme_id);

      if (!scheme) {
        throw new SchemeNotFoundError(args.scheme_id);
      }

      return {
        scheme: {
          id: scheme.id,
          name: scheme.name,
          ministry: scheme.ministry,
          category: scheme.category,
          description: scheme.description,
          benefits: scheme.benefits,
          eligibility_rules: scheme.eligibility,
          application_deadline: scheme.application_deadline,
          state_scope: scheme.state_scope,
          application_steps: scheme.application_steps,
          official_url: scheme.official_url,
          is_sample: scheme.is_sample,
        },
      };
    })
  );
}
