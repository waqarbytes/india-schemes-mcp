import { describe, it, expect, beforeEach } from "vitest";
import { JsonSchemeRepository } from "../src/lib/repository.js";
import type { Scheme } from "../src/lib/types.js";

const mockSchemes: Scheme[] = [
  {
    id: "pm-kisan",
    name: "PM Kisan Samman Nidhi",
    ministry: "Ministry of Agriculture",
    category: "Agriculture",
    description: "Income support for farmers",
    eligibility: [],
    benefits: "₹6,000 yearly",
    application_deadline: "open_all_year",
    official_url: "https://pmkisan.gov.in",
    state_scope: ["All India"],
    application_steps: ["Step 1"],
    is_sample: true,
  },
  {
    id: "atal-pension-yojana",
    name: "Atal Pension Yojana",
    ministry: "Ministry of Finance",
    category: "Social Security",
    description: "Pension for unorganized workers",
    eligibility: [],
    benefits: "₹1,000 to ₹5,000 monthly pension",
    application_deadline: "open_all_year",
    official_url: "https://npscra.nsdl.co.in",
    state_scope: ["All India"],
    application_steps: ["Step 1"],
    is_sample: true,
  },
  {
    id: "karnataka-gruha-lakshmi",
    name: "Gruha Lakshmi Scheme",
    ministry: "Government of Karnataka",
    category: "Women & Child",
    description: "Monthly aid for women head of household",
    eligibility: [],
    benefits: "₹2,000 monthly",
    application_deadline: "open_all_year",
    official_url: "https://karnataka.gov.in",
    state_scope: ["Karnataka"],
    application_steps: ["Step 1"],
    is_sample: true,
  },
];

describe("JsonSchemeRepository", () => {
  let repo: JsonSchemeRepository;

  beforeEach(() => {
    repo = new JsonSchemeRepository();
    repo.setMockData(mockSchemes);
  });

  it("should retrieve all schemes", async () => {
    const all = await repo.getAll();
    expect(all.length).toBe(3);
  });

  it("should get scheme by ID case-insensitively", async () => {
    const scheme = await repo.getById("PM-KISAN");
    expect(scheme).not.toBeNull();
    expect(scheme?.id).toBe("pm-kisan");
  });

  it("should return null for non-existent scheme ID", async () => {
    const scheme = await repo.getById("non-existent-id");
    expect(scheme).toBeNull();
  });

  it("should get multiple schemes by IDs", async () => {
    const matches = await repo.getByIds(["pm-kisan", "karnataka-gruha-lakshmi", "unknown-id"]);
    expect(matches.length).toBe(2);
    expect(matches.map((s) => s.id)).toEqual(["pm-kisan", "karnataka-gruha-lakshmi"]);
  });

  it("should rank exact ID and name matches higher in search", async () => {
    const results = await repo.search("pm-kisan");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.scheme.id).toBe("pm-kisan");
    expect(results[0]?.score).toBeGreaterThanOrEqual(100);
  });


  it("should filter search by category", async () => {
    const results = await repo.search("pension", { category: "Social Security" });
    expect(results.length).toBe(1);
    expect(results[0]?.scheme.id).toBe("atal-pension-yojana");

    const emptyResults = await repo.search("pension", { category: "Agriculture" });
    expect(emptyResults.length).toBe(0);
  });

  it("should filter search by state correctly", async () => {
    // Karnataka should match Gruha Lakshmi (state_scope: Karnataka) AND PM-Kisan (state_scope: All India)
    const karnatakaResults = await repo.search("", { state: "Karnataka" });
    const karnatakaIds = karnatakaResults.map((r) => r.scheme.id);
    expect(karnatakaIds).toContain("karnataka-gruha-lakshmi");
    expect(karnatakaIds).toContain("pm-kisan");

    // Maharashtra should NOT match Gruha Lakshmi
    const maharashtraResults = await repo.search("", { state: "Maharashtra" });
    const maharashtraIds = maharashtraResults.map((r) => r.scheme.id);
    expect(maharashtraIds).not.toContain("karnataka-gruha-lakshmi");
    expect(maharashtraIds).toContain("pm-kisan");
  });

  it("should respect search result limit", async () => {
    const results = await repo.search("", { limit: 1 });
    expect(results.length).toBe(1);
  });
});
