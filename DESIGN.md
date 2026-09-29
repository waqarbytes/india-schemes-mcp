# 🏛️ India Schemes MCP Server — Design Document

## 1. Goal
Provide LLMs (Claude Desktop, Cursor, AI agents) with deterministic, hallucination-free access to Indian Government Welfare Scheme information through the Model Context Protocol (MCP).

## 2. Core Architecture
- **Transport**: `StdioServerTransport` over standard input/output.
- **Protocol**: MCP Protocol Specification `v1.6.1`.
- **Validation**: Strict Zod schema validation on every tool input argument.
- **Data Access**: `JsonSchemeRepository` abstraction enabling seamless upgrades to Supabase/PostgreSQL.

## 3. Tool Specifications
1. `search_schemes`: Multi-attribute scoring across title, description, category, and state scope.
2. `get_scheme`: O(1) in-memory ID lookup returning full ministry metadata and verified gazette details.
3. `check_eligibility`: Deterministic evaluation engine supporting `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `between` operators across citizen demographic profiles.
4. `get_deadline`: Identifies open rolling schemes vs strict annual application cutoff windows.
5. `compare_schemes`: Side-by-side dimensional comparison for multi-scheme citizen trade-off decisions.
6. `get_application_steps`: Step-by-step roadmap with official portal endpoints and documentation requirements.

## 4. Error Handling & Rate Limiting
- All tool executions are wrapped in `createSafeToolHandler` to ensure all uncaught exceptions are sanitized and converted into descriptive error messages.
- Token-bucket rate limiter protects against client tool execution flooding.
