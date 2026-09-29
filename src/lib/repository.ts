/**
 * Scheme Repository Pattern
 * Provides an abstract interface for accessing scheme data, allowing seamless
 * replacement of the JSON backend with Supabase/PostgreSQL.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ISchemeRepository,
  Scheme,
  ScoredScheme,
  SearchOptions,
} from "./types.js";

export class JsonSchemeRepository implements ISchemeRepository {
  private cache: Scheme[] | null = null;
  private loadPromise: Promise<Scheme[]> | null = null;
  private readonly dataFilePath: string;

  constructor(customPath?: string) {
    if (customPath) {
      this.dataFilePath = customPath;
    } else {
      const currentDir = dirname(fileURLToPath(import.meta.url));
      const candidatePaths = [
        process.env.SCHEMES_FILE_PATH ?? "",
        resolve(currentDir, "../data/schemes.json"),
        resolve(currentDir, "./data/schemes.json"),
        resolve(currentDir, "../../data/schemes.json"),
        resolve(process.cwd(), "data/schemes.json"),
        resolve(process.cwd(), "dist/data/schemes.json"),
      ].filter(Boolean);

      const foundPath = candidatePaths.find((p) => existsSync(p));
      this.dataFilePath = foundPath ?? resolve(currentDir, "../data/schemes.json");
    }
  }

  /**
   * Loads data from the schemes.json file into memory with concurrency protection.
   */
  private async loadData(): Promise<Scheme[]> {
    if (this.cache !== null) {
      return this.cache;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        const raw = await readFile(this.dataFilePath, "utf-8");
        const parsed = JSON.parse(raw) as any[];
        this.cache = parsed.map((s) => ({
          id: s.id,
          name: s.name || s.title || "Government Scheme",
          ministry: s.ministry || (s.type === "Central" ? "Government of India" : "State Government"),
          category: s.category || "General Welfare",
          description: s.description || "",
          eligibility: Array.isArray(s.eligibility)
            ? s.eligibility
            : typeof s.eligibility === "string"
            ? [{ field: "general", operator: "eq", value: true, description: s.eligibility }]
            : (s.eligibility_rules || []),
          benefits: s.benefits || "",
          application_deadline: s.application_deadline || "open_all_year",
          official_url: s.official_url || s.url || "https://myscheme.gov.in",
          state_scope: s.state_scope || (s.type === "State" ? ["State Specific"] : ["All India"]),
          application_steps: Array.isArray(s.application_steps)
            ? s.application_steps
            : s.howToApply
            ? [s.howToApply]
            : ["Apply online through official portal."],
          is_sample: s.is_sample ?? false,
        }));
        return this.cache;
      } catch (error) {
        throw new Error(
          `Failed to load schemes data from ${this.dataFilePath}: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Invalidates cache, useful for test setups or hot-reloading.
   */
  public invalidateCache(): void {
    this.cache = null;
    this.loadPromise = null;
  }

  /**
   * Set custom data directly (useful for mocking in unit tests).
   */
  public setMockData(schemes: Scheme[]): void {
    this.cache = schemes;
  }

  public async getAll(): Promise<Scheme[]> {
    return this.loadData();
  }

  public async getById(id: string): Promise<Scheme | null> {
    const data = await this.loadData();
    const normalizedId = id.trim().toLowerCase();
    const match = data.find(
      (s) => s.id.toLowerCase() === normalizedId
    );
    return match ?? null;
  }

  public async getByIds(ids: string[]): Promise<Scheme[]> {
    const data = await this.loadData();
    const normalizedIds = new Set(ids.map((id) => id.trim().toLowerCase()));
    return data.filter((s) => normalizedIds.has(s.id.toLowerCase()));
  }

  public async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<ScoredScheme[]> {
    const data = await this.loadData();
    const trimmedQuery = query.trim().toLowerCase();
    const tokens = trimmedQuery
      .split(/[\s\-_\/]+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ""))
      .filter((t) => t.length > 1);

    const targetCategory = options.category?.trim().toLowerCase();
    const targetState = options.state?.trim().toLowerCase();
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);

    const scoredList: ScoredScheme[] = [];

    for (const scheme of data) {
      // 1. Category filter
      if (targetCategory && scheme.category.toLowerCase() !== targetCategory) {
        continue;
      }

      // 2. State filter
      if (targetState) {
        const stateScopes = scheme.state_scope.map((st) => st.toLowerCase());
        const isAllIndia = stateScopes.includes("all india") || stateScopes.includes("all");
        const hasState = stateScopes.includes(targetState);
        if (!isAllIndia && !hasState) {
          continue;
        }
      }

      let score = 0;
      const matchReasons: string[] = [];

      const schemeId = scheme.id.toLowerCase();
      const schemeName = scheme.name.toLowerCase();
      const ministry = scheme.ministry.toLowerCase();
      const description = scheme.description.toLowerCase();
      const benefits = scheme.benefits.toLowerCase();
      const category = scheme.category.toLowerCase();

      // Exact ID match
      if (schemeId === trimmedQuery) {
        score += 100;
        matchReasons.push("Exact scheme ID match");
      }

      // Exact name match
      if (schemeName === trimmedQuery) {
        score += 80;
        matchReasons.push("Exact scheme name match");
      } else if (schemeName.includes(trimmedQuery)) {
        score += 40;
        matchReasons.push("Full query contained in scheme name");
      }

      // Token matching
      for (const token of tokens) {
        if (schemeName.includes(token)) {
          score += 25;
          matchReasons.push(`Title contains '${token}'`);
        }
        if (category.includes(token)) {
          score += 15;
          matchReasons.push(`Category matches '${token}'`);
        }
        if (ministry.includes(token)) {
          score += 15;
          matchReasons.push(`Ministry matches '${token}'`);
        }
        if (description.includes(token)) {
          score += 10;
          matchReasons.push(`Description contains '${token}'`);
        }
        if (benefits.includes(token)) {
          score += 10;
          matchReasons.push(`Benefits contain '${token}'`);
        }
      }

      if (score > 0 || (trimmedQuery === "" && (targetCategory || targetState))) {
        scoredList.push({
          scheme,
          score,
          match_reasons: Array.from(new Set(matchReasons)),
        });
      }
    }

    scoredList.sort((a, b) => b.score - a.score);
    return scoredList.slice(0, limit);
  }
}

let repositoryInstance: ISchemeRepository | null = null;

export function getSchemeRepository(): ISchemeRepository {
  if (!repositoryInstance) {
    repositoryInstance = new JsonSchemeRepository();
  }
  return repositoryInstance;
}

export function setSchemeRepository(repo: ISchemeRepository): void {
  repositoryInstance = repo;
}
