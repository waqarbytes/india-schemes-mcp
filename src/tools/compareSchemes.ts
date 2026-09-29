/**
 * Tool: compare_schemes
 * Provides side-by-side comparative analysis of up to 5 Indian welfare schemes.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSchemeRepository } from "../lib/repository.js";
import type { ComparisonResult, SchemeComparisonItem } from "../lib/types.js";
import { createSafeToolHandler } from "./common.js";

export const compareSchemesSchema = {
  scheme_ids: z
    .array(z.string().min(1).max(100))
    .min(1, "At least one scheme ID must be provided")
    .max(5, "Comparison is capped at maximum 5 schemes at a time")
    .describe("List of scheme IDs to compare (1 to 5 IDs, e.g. ['pm-suraksha-bima', 'pm-jeevan-jyoti', 'atal-pension-yojana'])"),
};

export function registerCompareSchemesTool(server: McpServer): void {
  server.registerTool(
    "compare_schemes",
    {
      title: "Compare Schemes",
      description:
        "Perform side-by-side comparative analysis of up to 5 government welfare schemes across benefits, eligibility rules, and deadlines.",
      inputSchema: compareSchemesSchema,
    },
    createSafeToolHandler("compare_schemes", async (args: z.infer<z.ZodObject<typeof compareSchemesSchema>>) => {
      const repo = getSchemeRepository();
      const uniqueIds = Array.from(new Set(args.scheme_ids.map((id) => id.trim().toLowerCase())));
      const matchedSchemes = await repo.getByIds(uniqueIds);

      const foundIdSet = new Set(matchedSchemes.map((s) => s.id.toLowerCase()));
      const missingIds = uniqueIds.filter((id) => !foundIdSet.has(id));

      const comparisonItems: SchemeComparisonItem[] = matchedSchemes.map((s) => ({
        id: s.id,
        name: s.name,
        ministry: s.ministry,
        category: s.category,
        benefits: s.benefits,
        eligibility_rules_count: s.eligibility.length,
        eligibility_summary: s.eligibility.map((r) => r.description),
        application_deadline: s.application_deadline,
        state_scope: s.state_scope,
        official_url: s.official_url,
      }));

      const result: ComparisonResult = {
        total_compared: comparisonItems.length,
        schemes: comparisonItems,
        missing_ids: missingIds,
        is_sample: matchedSchemes.some((s) => s.is_sample),
      };

      return {
        comparison: result,
      };
    })
  );
}
