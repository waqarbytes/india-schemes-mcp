/**
 * Tool: check_eligibility
 * Evaluates user profile against the scheme's structured eligibility rules using a data-driven engine.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSchemeRepository } from "../lib/repository.js";
import { evaluateEligibility } from "../lib/eligibility.js";
import { createSafeToolHandler, SchemeNotFoundError } from "./common.js";

export const userProfileSchema = z
  .object({
    age: z
      .number()
      .int()
      .min(0, "Age cannot be negative")
      .max(130, "Age cannot exceed 130")
      .optional()
      .describe("Applicant's age in years (e.g. 28)"),
    occupation: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional()
      .describe("Applicant's primary occupation (e.g. 'farmer', 'street vendor', 'entrepreneur', 'artisan')"),
    income_annual: z
      .number()
      .min(0, "Annual income cannot be negative")
      .optional()
      .describe("Total annual family/household income in INR (e.g. 180000)"),
    state: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional()
      .describe("Resident state/UT (e.g. 'Karnataka', 'Maharashtra', 'Delhi')"),
    category: z
      .string()
      .max(100)
      .transform((s) => s.trim())
      .optional()
      .describe("Social category (e.g. 'General', 'OBC', 'SC', 'ST', 'EWS')"),
    gender: z
      .string()
      .max(50)
      .transform((s) => s.trim())
      .optional()
      .describe("Applicant gender ('male', 'female', 'transgender')"),
    land_holding_hectares: z
      .number()
      .min(0)
      .optional()
      .describe("Cultivable land owned in hectares (e.g. 1.5)"),
  })
  .passthrough();


export const checkEligibilitySchema = {
  scheme_id: z
    .string()
    .min(1, "Scheme ID cannot be empty")
    .max(100)
    .describe("The unique ID of the scheme to evaluate eligibility against"),
  user_profile: userProfileSchema.describe("The applicant's demographic and financial profile attributes"),
};

export function registerCheckEligibilityTool(server: McpServer): void {
  server.registerTool(
    "check_eligibility",
    {
      title: "Check Scheme Eligibility",
      description:
        "Evaluate whether an applicant qualifies for a government scheme based on their profile (age, income, occupation, state, etc.) using a data-driven rules engine.",
      inputSchema: checkEligibilitySchema,
    },
    createSafeToolHandler("check_eligibility", async (args: z.infer<z.ZodObject<typeof checkEligibilitySchema>>) => {
      const repo = getSchemeRepository();
      const scheme = await repo.getById(args.scheme_id);

      if (!scheme) {
        throw new SchemeNotFoundError(args.scheme_id);
      }

      const evaluation = evaluateEligibility(scheme, args.user_profile);

      return {
        scheme_id: evaluation.scheme_id,
        scheme_name: evaluation.scheme_name,
        eligible: evaluation.eligible,
        summary: evaluation.summary,
        passed_rules: evaluation.passed_rules,
        failed_rules: evaluation.failed_rules,
        unevaluated_rules: evaluation.unevaluated_rules,
        is_sample: evaluation.is_sample,
      };
    })
  );
}
