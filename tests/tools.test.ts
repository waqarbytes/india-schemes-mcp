import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "../src/tools/index.js";
import { globalRateLimiter } from "../src/lib/rateLimiter.js";

// Helper to invoke a registered tool directly on McpServer instance
async function callServerTool(server: McpServer, name: string, args: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registeredTool = (server as any)._registeredTools?.[name];
  if (!registeredTool) {
    throw new Error(`Tool ${name} is not registered on server`);
  }
  return registeredTool.handler(args, {});
}

describe("MCP Tools Suite (Happy-Path & Error-Path)", () => {
  let server: McpServer;

  beforeEach(() => {
    globalRateLimiter.reset();
    server = new McpServer({ name: "test-server", version: "1.0.0" });
    registerAllTools(server);
  });

  // Tool 1: search_schemes
  describe("search_schemes", () => {
    it("happy-path: returns matching schemes with relevance scores", async () => {
      const response = await callServerTool(server, "search_schemes", {
        query: "farmer income",
        category: "Agriculture",
      });

      expect(response.isError).toBeUndefined();
      expect(response.content).toHaveLength(1);
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.query).toBe("farmer income");
      expect(parsed.total_results).toBeGreaterThan(0);
      expect(parsed.results[0].id).toBe("pm-kisan");
    });

    it("error-path: handles non-matching queries gracefully without crashing", async () => {
      const response = await callServerTool(server, "search_schemes", {
        query: "xyznonexistentquery123",
      });

      expect(response.isError).toBeUndefined();
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.total_results).toBe(0);
      expect(parsed.results).toEqual([]);
    });
  });

  // Tool 2: get_scheme
  describe("get_scheme", () => {
    it("happy-path: returns full scheme details for valid ID", async () => {
      const response = await callServerTool(server, "get_scheme", {
        scheme_id: "pm-kisan",
      });

      expect(response.isError).toBeUndefined();
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.scheme).toBeDefined();
      expect(parsed.scheme.id).toBe("pm-kisan");
      expect(parsed.scheme.name).toContain("PM-KISAN");
      expect(parsed.scheme.eligibility_rules.length).toBeGreaterThan(0);
    });

    it("error-path: returns structured SCHEME_NOT_FOUND error for invalid ID", async () => {
      const response = await callServerTool(server, "get_scheme", {
        scheme_id: "invalid-scheme-id",
      });

      expect(response.isError).toBe(true);
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBe("SCHEME_NOT_FOUND");
      expect(parsed.error.message).toContain("invalid-scheme-id");
    });
  });

  // Tool 3: check_eligibility
  describe("check_eligibility", () => {
    it("happy-path: correctly evaluates user eligibility against rules", async () => {
      const response = await callServerTool(server, "check_eligibility", {
        scheme_id: "pm-kisan",
        user_profile: {
          age: 35,
          occupation: "farmer",
        },
      });

      expect(response.isError).toBeUndefined();
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.scheme_id).toBe("pm-kisan");
      expect(parsed.eligible).toBeDefined();
    });

    it("error-path: returns structured error when checking eligibility for non-existent scheme", async () => {
      const response = await callServerTool(server, "check_eligibility", {
        scheme_id: "unknown-scheme",
        user_profile: {
          age: 25,
        },
      });

      expect(response.isError).toBe(true);
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.error.code).toBe("SCHEME_NOT_FOUND");
    });
  });

  // Tool 4: get_deadline
  describe("get_deadline", () => {
    it("happy-path: returns open/rolling status for ongoing schemes", async () => {
      const response = await callServerTool(server, "get_deadline", {
        scheme_id: "pm-kisan",
      });

      expect(response.isError).toBeUndefined();
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.deadline_info).toBeDefined();
      expect(parsed.deadline_info.status).toBe("ROLLING");
      expect(parsed.deadline_info.is_expired).toBe(false);
    });

    it("error-path: returns structured error for non-existent scheme ID", async () => {
      const response = await callServerTool(server, "get_deadline", {
        scheme_id: "fake-scheme-id",
      });

      expect(response.isError).toBe(true);
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.error.code).toBe("SCHEME_NOT_FOUND");
    });
  });

  // Tool 5: compare_schemes
  describe("compare_schemes", () => {
    it("happy-path: compares multiple valid schemes side-by-side", async () => {
      const response = await callServerTool(server, "compare_schemes", {
        scheme_ids: ["pm-kisan", "fasal-bima"],
      });

      expect(response.isError).toBeUndefined();
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.comparison).toBeDefined();
      expect(parsed.comparison.total_compared).toBe(2);
      expect(parsed.comparison.schemes[0].id).toBe("pm-kisan");
      expect(parsed.comparison.schemes[1].id).toBe("fasal-bima");
      expect(parsed.comparison.missing_ids).toEqual([]);
    });

    it("error-path: handles partially unknown IDs gracefully in missing_ids", async () => {
      const response = await callServerTool(server, "compare_schemes", {
        scheme_ids: ["pm-kisan", "non-existent-xyz"],
      });

      expect(response.isError).toBeUndefined();
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.comparison.total_compared).toBe(1);
      expect(parsed.comparison.missing_ids).toEqual(["non-existent-xyz"]);
    });
  });

  // Tool 6: get_application_steps
  describe("get_application_steps", () => {
    it("happy-path: returns step-by-step guidance and official URL", async () => {
      const response = await callServerTool(server, "get_application_steps", {
        scheme_id: "pm-kisan",
      });

      expect(response.isError).toBeUndefined();
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.application_guide).toBeDefined();
      expect(parsed.application_guide.scheme_id).toBe("pm-kisan");
      expect(Array.isArray(parsed.application_guide.steps)).toBe(true);
      expect(parsed.application_guide.steps.length).toBeGreaterThan(0);
      expect(parsed.application_guide.official_url).toBe("https://pmkisan.gov.in");
    });

    it("error-path: returns structured error for non-existent scheme", async () => {
      const response = await callServerTool(server, "get_application_steps", {
        scheme_id: "no-such-scheme",
      });

      expect(response.isError).toBe(true);
      const parsed = JSON.parse(response.content[0].text);
      expect(parsed.error.code).toBe("SCHEME_NOT_FOUND");
    });
  });
});
