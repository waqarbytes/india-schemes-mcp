import { describe, it, expect } from "vitest";
import { evaluateEligibility } from "../src/lib/eligibility.js";
import type { Scheme } from "../src/lib/types.js";

const sampleScheme: Scheme = {
  id: "test-scheme",
  name: "Test Scheme",
  ministry: "Ministry of Test",
  category: "Social Security",
  description: "Test description",
  eligibility: [
    {
      field: "age",
      operator: "gte",
      value: 18,
      description: "Minimum age 18",
    },
    {
      field: "age",
      operator: "lte",
      value: 60,
      description: "Maximum age 60",
    },
    {
      field: "income_annual",
      operator: "lte",
      value: 300000,
      description: "Annual income must not exceed ₹3,00,000",
    },
    {
      field: "occupation",
      operator: "in",
      value: ["farmer", "artisan"],
      description: "Must be a farmer or artisan",
    },
    {
      field: "state",
      operator: "in",
      value: ["Karnataka", "Maharashtra", "All India"],
      description: "State eligibility",
    },
  ],
  benefits: "Test benefits",
  application_deadline: "2026-12-31",
  official_url: "https://example.gov.in",
  state_scope: ["Karnataka", "Maharashtra"],
  application_steps: ["Step 1", "Step 2"],
  is_sample: true,
};

describe("Eligibility Engine", () => {
  it("should pass eligibility when all rules match", () => {
    const profile = {
      age: 30,
      income_annual: 200000,
      occupation: "farmer",
      state: "Karnataka",
    };

    const result = evaluateEligibility(sampleScheme, profile);
    expect(result.eligible).toBe(true);
    expect(result.passed_rules.length).toBe(5);
    expect(result.failed_rules.length).toBe(0);
    expect(result.unevaluated_rules.length).toBe(0);
  });

  it("should fail eligibility when age is outside bounds", () => {
    const profile = {
      age: 16,
      income_annual: 200000,
      occupation: "farmer",
      state: "Karnataka",
    };

    const result = evaluateEligibility(sampleScheme, profile);
    expect(result.eligible).toBe(false);
    expect(result.failed_rules.length).toBe(1);
    expect(result.failed_rules[0]?.field).toBe("age");
    expect(result.failed_rules[0]?.reason).toContain("less than required minimum");
  });

  it("should fail eligibility when income exceeds threshold", () => {
    const profile = {
      age: 25,
      income_annual: 500000,
      occupation: "farmer",
      state: "Karnataka",
    };

    const result = evaluateEligibility(sampleScheme, profile);
    expect(result.eligible).toBe(false);
    expect(result.failed_rules.length).toBe(1);
    expect(result.failed_rules[0]?.field).toBe("income_annual");
    expect(result.failed_rules[0]?.reason).toContain("exceeds maximum threshold");
  });

  it("should fail eligibility when occupation is not in allowed list", () => {
    const profile = {
      age: 25,
      income_annual: 200000,
      occupation: "software engineer",
      state: "Karnataka",
    };

    const result = evaluateEligibility(sampleScheme, profile);
    expect(result.eligible).toBe(false);
    expect(result.failed_rules.length).toBe(1);
    expect(result.failed_rules[0]?.field).toBe("occupation");
    expect(result.failed_rules[0]?.reason).toContain("not in allowed set");
  });

  it("should handle missing profile fields by adding to unevaluated_rules", () => {
    const profile = {
      age: 25,
      occupation: "farmer",
    };

    const result = evaluateEligibility(sampleScheme, profile);
    expect(result.eligible).toBe(false);
    expect(result.passed_rules.length).toBe(3); // age gte 18, age lte 60, occupation in
    expect(result.unevaluated_rules.length).toBe(2); // income_annual, state
    expect(result.unevaluated_rules.map((r) => r.field)).toEqual(["income_annual", "state"]);
  });

  it("should support eq, neq, gt, lt operators", () => {
    const customScheme: Scheme = {
      ...sampleScheme,
      eligibility: [
        { field: "gender", operator: "eq", value: "female", description: "Must be female" },
        { field: "category", operator: "neq", value: "excluded", description: "Not excluded" },
        { field: "land_holding_hectares", operator: "gt", value: 0, description: "Land > 0" },
        { field: "score", operator: "lt", value: 100, description: "Score < 100" },
      ],
    };

    const passProfile = {
      gender: "FEMALE", // test case-insensitivity
      category: "General",
      land_holding_hectares: 1.2,
      score: 80,
    };

    const passResult = evaluateEligibility(customScheme, passProfile);
    expect(passResult.eligible).toBe(true);

    const failProfile = {
      gender: "male",
      category: "excluded",
      land_holding_hectares: 0,
      score: 120,
    };

    const failResult = evaluateEligibility(customScheme, failProfile);
    expect(failResult.eligible).toBe(false);
    expect(failResult.failed_rules.length).toBe(4);
  });

  it("should be resilient against prototype pollution field names", () => {
    const maliciousScheme: Scheme = {
      ...sampleScheme,
      eligibility: [
        { field: "__proto__", operator: "eq", value: "polluted", description: "Malicious rule" },
        { field: "constructor", operator: "eq", value: "polluted", description: "Malicious constructor" },
      ],
    };

    const result = evaluateEligibility(maliciousScheme, {});
    expect(result.passed_rules.length).toBe(0);
    expect(result.failed_rules.length).toBe(0);
  });
});

