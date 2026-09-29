/**
 * Data-driven eligibility evaluation engine.
 * Evaluates arbitrary rules stored in scheme definitions against user profiles.
 */

import type {
  EligibilityEvaluation,
  EligibilityRule,
  RuleFailResult,
  RulePassResult,
  RuleUnevaluatedResult,
  Scheme,
  UserProfile,
} from "./types.js";

/**
 * Normalizes string comparison (lowercasing and trimming)
 */
function normalizeString(val: unknown): string {
  return String(val).trim().toLowerCase();
}

/**
 * Compares two scalar values with given operator
 */
function evaluateComparison(
  userValue: unknown,
  operator: EligibilityRule["operator"],
  targetValue: unknown
): { pass: boolean; failureReason?: string } {
  if (operator === "gte" || operator === "gt" || operator === "lte" || operator === "lt") {
    const numUser = Number(userValue);
    const numTarget = Number(targetValue);

    if (isNaN(numUser) || isNaN(numTarget)) {
      return {
        pass: false,
        failureReason: `Numeric comparison failed: user value (${String(userValue)}) or target value (${String(targetValue)}) is not a valid number.`,
      };
    }

    if (operator === "gte") {
      return numUser >= numTarget
        ? { pass: true }
        : { pass: false, failureReason: `Value ${numUser} is less than required minimum of ${numTarget}.` };
    }
    if (operator === "gt") {
      return numUser > numTarget
        ? { pass: true }
        : { pass: false, failureReason: `Value ${numUser} is not strictly greater than ${numTarget}.` };
    }
    if (operator === "lte") {
      return numUser <= numTarget
        ? { pass: true }
        : { pass: false, failureReason: `Value ${numUser} exceeds maximum threshold of ${numTarget}.` };
    }
    if (operator === "lt") {
      return numUser < numTarget
        ? { pass: true }
        : { pass: false, failureReason: `Value ${numUser} is not strictly less than ${numTarget}.` };
    }
  }

  if (operator === "eq") {
    if (typeof userValue === "string" && typeof targetValue === "string") {
      const match = normalizeString(userValue) === normalizeString(targetValue);
      return match
        ? { pass: true }
        : { pass: false, failureReason: `Expected '${targetValue}', but user profile has '${String(userValue)}'.` };
    }
    const match = userValue === targetValue;
    return match
      ? { pass: true }
      : { pass: false, failureReason: `Value does not match required value '${String(targetValue)}'.` };
  }

  if (operator === "neq") {
    if (typeof userValue === "string" && typeof targetValue === "string") {
      const notMatch = normalizeString(userValue) !== normalizeString(targetValue);
      return notMatch
        ? { pass: true }
        : { pass: false, failureReason: `Value '${String(userValue)}' must not equal '${targetValue}'.` };
    }
    const notMatch = userValue !== targetValue;
    return notMatch
      ? { pass: true }
      : { pass: false, failureReason: `Value must not equal '${String(targetValue)}'.` };
  }

  if (operator === "in") {
    if (Array.isArray(targetValue)) {
      const normalizedUser = normalizeString(userValue);
      // Special case: if target array includes "all india", state matches everything
      const normalizedTargets = targetValue.map(normalizeString);
      if (normalizedTargets.includes("all india") || normalizedTargets.includes("all")) {
        return { pass: true };
      }
      const found = normalizedTargets.includes(normalizedUser);
      return found
        ? { pass: true }
        : {
            pass: false,
            failureReason: `'${String(userValue)}' is not in allowed set: [${targetValue.join(", ")}].`,
          };
    }
    return {
      pass: false,
      failureReason: `Invalid rule configuration: 'in' operator requires an array target.`,
    };
  }

  if (operator === "not_in") {
    if (Array.isArray(targetValue)) {
      const normalizedUser = normalizeString(userValue);
      const normalizedTargets = targetValue.map(normalizeString);
      const found = normalizedTargets.includes(normalizedUser);
      return !found
        ? { pass: true }
        : {
            pass: false,
            failureReason: `'${String(userValue)}' is excluded by rule: [${targetValue.join(", ")}].`,
          };
    }
    return {
      pass: false,
      failureReason: `Invalid rule configuration: 'not_in' operator requires an array target.`,
    };
  }

  return {
    pass: false,
    failureReason: `Unsupported rule operator: '${operator}'.`,
  };
}

const DANGEROUS_FIELDS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Evaluates all eligibility rules of a scheme against a user profile.
 */
export function evaluateEligibility(
  scheme: Scheme,
  userProfile: UserProfile
): EligibilityEvaluation {
  const passedRules: RulePassResult[] = [];
  const failedRules: RuleFailResult[] = [];
  const unevaluatedRules: RuleUnevaluatedResult[] = [];

  for (const rule of scheme.eligibility) {
    // Guard against prototype pollution keys
    if (DANGEROUS_FIELDS.has(rule.field)) {
      continue;
    }

    const hasField = Object.prototype.hasOwnProperty.call(userProfile, rule.field);
    const userValue = hasField ? userProfile[rule.field] : undefined;

    if (userValue === undefined || userValue === null || userValue === "") {
      unevaluatedRules.push({
        rule: rule.description,
        field: rule.field,
        required_value: rule.value,
        reason: `Profile field '${rule.field}' was not provided.`,
      });
      continue;
    }


    const { pass, failureReason } = evaluateComparison(
      userValue,
      rule.operator,
      rule.value
    );

    if (pass) {
      passedRules.push({
        rule: rule.description,
        passed: true,
        field: rule.field,
        user_value: userValue,
        required_value: rule.value,
      });
    } else {
      failedRules.push({
        rule: rule.description,
        passed: false,
        field: rule.field,
        user_value: userValue,
        required_value: rule.value,
        reason: failureReason ?? "Criteria not met.",
      });
    }
  }

  const hasFailures = failedRules.length > 0;
  const hasUnevaluated = unevaluatedRules.length > 0;
  const isEligible = !hasFailures && !hasUnevaluated;

  let summary = "";
  if (isEligible) {
    summary = `User meets all ${passedRules.length} evaluated eligibility criteria for ${scheme.name}.`;
  } else if (hasFailures) {
    summary = `User does not qualify for ${scheme.name} due to ${failedRules.length} failed condition(s).`;
  } else {
    summary = `User satisfies ${passedRules.length} criteria, but ${unevaluatedRules.length} field(s) were missing in profile to confirm full eligibility.`;
  }

  return {
    scheme_id: scheme.id,
    scheme_name: scheme.name,
    eligible: isEligible,
    summary,
    passed_rules: passedRules,
    failed_rules: failedRules,
    unevaluated_rules: unevaluatedRules,
    is_sample: scheme.is_sample ?? true,
  };
}
