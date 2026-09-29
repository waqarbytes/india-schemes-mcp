/**
 * Tool: search_schemes
 * Performs keyword search across Indian welfare schemes with relevance scoring and filters.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSchemeRepository } from "../lib/repository.js";
import { createSafeToolHandler } from "./common.js";

export const searchSchemesSchema = {
  query: z
    .string()
    .min(1, "Search query cannot be empty")
    .max(200, "Query exceeds maximum 200 characters")
    .describe("Keywords to search across scheme name, ministry, description, or benefits (e.g., 'farmer income', 'health insurance', 'pension')"),
  category: z
    .string()
    .max(100)
    .optional()
    .describe("Optional category filter (e.g., 'Agriculture', 'Healthcare', 'Social Security', 'Housing', 'Women & Child', 'Financial Inclusion')"),
  state: z
    .string()
    .max(100)
    .optional()
    .describe("Optional state filter (e.g., 'Karnataka', 'Maharashtra', 'Delhi', 'All India')"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe("Maximum number of results to return (1 to 50, default: 10)"),
};

export function registerSearchSchemesTool(server: McpServer): void {
  server.registerTool(
    "search_schemes",
    {
      title: "Search Schemes",
      description:
        "Search Indian government welfare schemes using keywords with relevance scoring. Supports optional filtering by category and state.",
      inputSchema: searchSchemesSchema,
    },
    createSafeToolHandler("search_schemes", async (args: z.infer<z.ZodObject<typeof searchSchemesSchema>>) => {
      const repo = getSchemeRepository();
      const scoredResults = await repo.search(args.query, {
        category: args.category,
        state: args.state,
        limit: args.limit,
      });

      return {
        query: args.query,
        filters: {
          category: args.category ?? null,
          state: args.state ?? null,
        },
        total_results: scoredResults.length,
        results: scoredResults.map((item) => ({
          id: item.scheme.id,
          name: item.scheme.name,
          ministry: item.scheme.ministry,
          category: item.scheme.category,
          description: item.scheme.description,
          benefits: item.scheme.benefits,
          state_scope: item.scheme.state_scope,
          relevance_score: item.score,
          match_reasons: item.match_reasons,
          is_sample: item.scheme.is_sample,
        })),
      };
    })
  );
}
