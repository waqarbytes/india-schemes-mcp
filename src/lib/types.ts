/**
 * Domain types for india-schemes-mcp
 */

export type RuleField =
  | "age"
  | "income_annual"
  | "occupation"
  | "state"
  | "category"
  | "gender"
  | "land_holding_hectares";

export type RuleOperator =
  | "gte"
  | "lte"
  | "gt"
  | "lt"
  | "eq"
  | "neq"
  | "in"
  | "not_in";

export interface EligibilityRule {
  field: RuleField | string;
  operator: RuleOperator;
  value: number | string | string[] | boolean;
  description: string;
}

export interface Scheme {
  id: string;
  name: string;
  ministry: string;
  category: string;
  description: string;
  eligibility: EligibilityRule[];
  benefits: string;
  application_deadline: string; // ISO date "YYYY-MM-DD" or "rolling" / "open_all_year"
  official_url: string;
  state_scope: string[];
  application_steps: string[];
  is_sample: boolean;
}

export interface UserProfile {
  age?: number;
  occupation?: string;
  income_annual?: number;
  state?: string;
  category?: string;
  gender?: string;
  land_holding_hectares?: number;
  [key: string]: unknown;
}

export interface RulePassResult {
  rule: string;
  passed: true;
  field: string;
  user_value: unknown;
  required_value: unknown;
}

export interface RuleFailResult {
  rule: string;
  passed: false;
  field: string;
  user_value: unknown;
  required_value: unknown;
  reason: string;
}

export interface RuleUnevaluatedResult {
  rule: string;
  field: string;
  required_value: unknown;
  reason: string;
}

export interface EligibilityEvaluation {
  scheme_id: string;
  scheme_name: string;
  eligible: boolean;
  summary: string;
  passed_rules: RulePassResult[];
  failed_rules: RuleFailResult[];
  unevaluated_rules: RuleUnevaluatedResult[];
  is_sample: boolean;
}

export interface ScoredScheme {
  scheme: Scheme;
  score: number;
  match_reasons: string[];
}

export interface SearchOptions {
  category?: string;
  state?: string;
  limit?: number;
}

export interface DeadlineInfo {
  scheme_id: string;
  scheme_name: string;
  application_deadline: string;
  status: "OPEN" | "CLOSED" | "ROLLING";
  days_remaining: number | null;
  is_expired: boolean;
  notes: string;
  is_sample: boolean;
}

export interface SchemeComparisonItem {
  id: string;
  name: string;
  ministry: string;
  category: string;
  benefits: string;
  eligibility_rules_count: number;
  eligibility_summary: string[];
  application_deadline: string;
  state_scope: string[];
  official_url: string;
}

export interface ComparisonResult {
  total_compared: number;
  schemes: SchemeComparisonItem[];
  missing_ids: string[];
  is_sample: boolean;
}

export interface ApplicationStepsResult {
  scheme_id: string;
  scheme_name: string;
  steps: string[];
  official_url: string;
  is_sample: boolean;
}

export interface ISchemeRepository {
  getAll(): Promise<Scheme[]>;
  getById(id: string): Promise<Scheme | null>;
  getByIds(ids: string[]): Promise<Scheme[]>;
  search(query: string, options?: SearchOptions): Promise<ScoredScheme[]>;
}

export interface ToolErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

