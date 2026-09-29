# 🇮🇳 India Schemes MCP Server (`india-schemes-mcp`)

> 🌐 **Product layer over this data**: [Yojana Dost](https://yojana-dost.onrender.com/) — live at https://yojana-dost.onrender.com/

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](https://github.com/waqarbytes/india-schemes-mcp)
[![MCP](https://img.shields.io/badge/MCP-1.6.1-purple.svg)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A production-grade **Model Context Protocol (MCP)** server providing structured tools for Claude Desktop, Cursor, and any MCP client to search, analyze, compare, and verify eligibility for **120+ Indian Central and State Government Welfare Schemes**.

---

## 🛠️ MCP Tools Exposed

This server exposes 6 production-grade tools with strict **Zod schema validation** and structured stderr diagnostic logging:

| Tool Name | Parameters | Description |
|---|---|---|
| `search_schemes` | `query`, `category?`, `state?`, `limit?` | Full-text and keyword search across 120+ schemes with relevance scoring and filter support. |
| `get_scheme` | `scheme_id` | Retrieves complete verified details for a specific scheme (ministry, benefits, eligibility, rules, official URL). |
| `check_eligibility` | `scheme_id`, `user_profile` (`age`, `gender`, `state`, `income`, `caste`, `land`, `occupation`, `disability`) | Deterministic eligibility evaluation against official scheme criteria with detailed pass/fail breakdown. |
| `get_deadline` | `scheme_id` | Returns application deadlines, rolling enrollment cycles, renewal schedules, and official timeline rules. |
| `compare_schemes` | `scheme_ids` (array of 2–5 IDs) | Generates side-by-side comparison matrix across benefits, eligibility thresholds, and required documentation. |
| `get_application_steps` | `scheme_id` | Step-by-step citizen application roadmap, portal URLs, offline submission offices, and document checklist. |

---

## 🚀 Quickstart & Installation

### Prerequisites
- Node.js `>= 20.0.0`
- npm `>= 10.0.0`

### 1. Clone & Build
```bash
git clone https://github.com/waqarbytes/india-schemes-mcp.git
cd india-schemes-mcp
npm install
npm run build
```

### 2. Test with MCP Inspector
Inspect and interact with all 6 tools using the official Model Context Protocol Inspector UI:
```bash
npm run inspect
```

---

## 💻 Claude Desktop Configuration

To connect this server to **Claude Desktop**, add the configuration below to your `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "india-schemes": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/india-schemes-mcp/dist/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

Restart Claude Desktop, and click the 🔨 icon in chat to verify all 6 tools are loaded.

---

## 🧪 Testing

Run the full Vitest suite testing repository lookups, rule evaluation operators, token-bucket rate limiters, and tool schemas:

```bash
npm test
```

---

## 🏛️ Architecture & Reliability

- **Standard IO Transport**: Connects via `@modelcontextprotocol/sdk/server/stdio.js` for zero-overhead local IPC.
- **Strict Error Handling**: Errors return structured MCP text payloads with error codes rather than unhandled process terminations.
- **In-Memory Cache & Concurrency Protection**: Scheme records are safely parsed and cached on demand.
- **Process Lifecycle**: Clean `SIGINT` and `SIGTERM` listeners guarantee graceful shutdown.

---

## 📜 License

MIT License. Copyright (c) 2026 Mohd Waqar.
