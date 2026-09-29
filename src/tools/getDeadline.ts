/**
 * Tool: get_deadline
 * Fetches application deadline, calculates days remaining, and checks open/closed status.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSchemeRepository } from "../lib/repository.js";
import type { DeadlineInfo } from "../lib/types.js";
import { createSafeToolHandler, SchemeNotFoundError } from "./common.js";

export const getDeadlineSchema = {
  scheme_id: z
    .string()
    .min(1, "Scheme ID cannot be empty")
    .max(100)
    .describe("The unique ID of the scheme (e.g., 'pm-svanidhi', 'pm-kisan')"),
};

export function calculateDeadlineInfo(schemeId: string, schemeName: string, deadlineStr: string, isSample: boolean): DeadlineInfo {
  const normalized = deadlineStr.trim().toLowerCase();

  if (
    normalized === "open_all_year" ||
    normalized === "rolling" ||
    normalized === "ongoing" ||
    normalized === "continuous"
  ) {
    return {
      scheme_id: schemeId,
      scheme_name: schemeName,
      application_deadline: deadlineStr,
      status: "ROLLING",
      days_remaining: null,
      is_expired: false,
      notes: "Scheme operates with continuous open enrollment throughout the year.",
      is_sample: isSample,
    };
  }

  // Parse ISO date (YYYY-MM-DD) or general date
  let deadlineDate: Date;
  const isoMatch = deadlineStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  
  if (isoMatch) {
    const year = parseInt(isoMatch[1]!, 10);
    const month = parseInt(isoMatch[2]!, 10) - 1;
    const day = parseInt(isoMatch[3]!, 10);
    deadlineDate = new Date(year, month, day, 23, 59, 59, 999);
  } else {
    deadlineDate = new Date(deadlineStr);
  }

  if (isNaN(deadlineDate.getTime())) {
    return {
      scheme_id: schemeId,
      scheme_name: schemeName,
      application_deadline: deadlineStr,
      status: "OPEN",
      days_remaining: null,
      is_expired: false,
      notes: `Custom enrollment cycle: ${deadlineStr}`,
      is_sample: isSample,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = deadlineDate.getTime() - today.getTime();
  const rawDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (rawDays >= 0) {
    return {
      scheme_id: schemeId,
      scheme_name: schemeName,
      application_deadline: deadlineStr,
      status: "OPEN",
      days_remaining: rawDays,
      is_expired: false,
      notes: `${rawDays} day(s) remaining before application window closes (${deadlineStr}).`,
      is_sample: isSample,
    };
  } else {
    return {
      scheme_id: schemeId,
      scheme_name: schemeName,
      application_deadline: deadlineStr,
      status: "CLOSED",
      days_remaining: 0,
      is_expired: true,
      notes: `Application cycle closed on ${deadlineStr} (${Math.abs(rawDays)} day(s) ago).`,
      is_sample: isSample,
    };
  }

}

export function registerGetDeadlineTool(server: McpServer): void {
  server.registerTool(
    "get_deadline",
    {
      title: "Get Scheme Deadline",
      description:
        "Check the application deadline, remaining days, and open/closed enrollment status for an Indian government scheme.",
      inputSchema: getDeadlineSchema,
    },
    createSafeToolHandler("get_deadline", async (args: z.infer<z.ZodObject<typeof getDeadlineSchema>>) => {
      const repo = getSchemeRepository();
      const scheme = await repo.getById(args.scheme_id);

      if (!scheme) {
        throw new SchemeNotFoundError(args.scheme_id);
      }

      const info = calculateDeadlineInfo(
        scheme.id,
        scheme.name,
        scheme.application_deadline,
        scheme.is_sample
      );

      return {
        deadline_info: info,
      };
    })
  );
}
