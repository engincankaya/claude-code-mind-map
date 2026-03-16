# Mind Map Generator

Architecture-aware mind map generator for code repositories. A Claude Code plugin that combines Tree-sitter parsing with LLM intelligence to produce meaningful, interactive codebase visualizations.

<img width="1512" height="783" alt="mind-map" src="https://github.com/user-attachments/assets/91f5c112-eb24-4a24-8731-1f2c34bf935b" />

## Overview

This project is a monorepo consisting of:

- **MCP Server** (TypeScript) — 8-stage deterministic pipeline that scans, parses, and builds mind map graphs
- **Frontend** (HTML/CSS/JS) — Interactive browser-based visualization with dark theme, tree layout, detail cards, and zoom/pan controls
- **Claude Code Integration** — Agents, commands, and skills for seamless Claude Code workflow

## Architecture

```
┌──────────────────────────────────────────────┐
│           Claude Code (LLM Agent)            │
│  Orchestrates phases, interprets data,       │
│  makes architectural judgments                │
└────────────┬─────────────────┬───────────────┘
             │ calls tools     │ receives results
             ▼                 ▼
┌──────────────────────────────────────────────┐
│             MCP Tool Server                  │
│                                              │
│  scan → resolve → context → parse            │

│  sample → build → validate → publish         │
│                                              │
│  Zero LLM logic. Pure data in, data out.     │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │     Artifact Store (In-Memory)         │  │
│  │  Stores pipeline results by ID,        │  │
│  │  ~75-87% token savings                 │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

## MCP Tools (8-Stage Pipeline)

| Tool | Purpose |
|------|---------|
| `mindmap.scan` | List repository files with configurable ignore patterns |
| `mindmap.resolve` | Canonicalize paths, produce stable file IDs and content hashes |
| `mindmap.context` | Extract project metadata (README, package managers, folder structure) |
| `mindmap.parse` | Parse source code via Tree-sitter at 3 depth levels (summary/standard/detailed) |
| `mindmap.sample` | Read code snippets by line range for LLM interpretation |
| `mindmap.build` | Construct mind map graph from LLM's architecture plan |
| `mindmap.validate` | Check graph integrity (orphan nodes, broken edges, cycles) |
| `mindmap.publish` | Bundle artifacts, emit structured output, write to disk |

## Language Support

Multi-language parsing via Tree-sitter (web-tree-sitter 0.24):

| Language | Status |
|----------|--------|
| TypeScript / JavaScript / TSX / JSX | Tier 1 |
| Python | Tier 1 |
| Go | Tier 1 |
| Rust | Tier 1 |
| Java | Tier 1 |

Each language has a dedicated normalizer that extracts imports, exports, and symbols into a unified format.

## Prerequisites

- Node.js >= 20.0.0
- Claude Code CLI

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd mind-map

# Install MCP server dependencies
cd mcp-server
npm install

# Build
npm run build
```

## Usage

### With Claude Code

The project registers itself as an MCP server via [.mcp.json](.mcp.json). Once built, Claude Code automatically discovers the tools.

```bash
# Generate a mind map for any repository
/mindmap /path/to/your/project
```

### Available Claude Code Commands

| Command | Description |
|---------|-------------|
| `/mindmap` | Generate an architecture-aware mind map |
| `/explain` | Explain the architectural role of a file or component |
| `/impact` | Analyze the impact of changing a file or component |

### Available Agents

| Agent | Description |
|-------|-------------|
| `mindmap-agent` | Orchestrates the full mind map generation pipeline |
| `architect-agent` | Architecture-aware coding assistant using the mind map knowledge graph |
| `impact-agent` | Analyzes ripple effects of code changes via dependency tracing |
| `onboard-agent` | Interactive project onboarding guide for new developers |

### Frontend Visualization

Open [frontend/index.html](frontend/index.html) in a browser with a generated `mindmap-output.json` file. The frontend provides:

- Interactive tree layout with collapsible group nodes
- Detail cards showing file roles, dependencies, and importance
- Zoom/pan controls and keyboard shortcuts
- Dark theme inspired by NotebookLM
- Project overview panel with statistics


## Development

```bash
cd mcp-server

# Watch mode
npm run dev

# Run tests
npm test

# Type check
npm run lint
```

## Output Format

The generated mind map is a JSON graph (MindMapJSON) containing:

- **Nodes**: root, group, file, and symbol nodes with metadata (role, importance, language, confidence)
- **Edges**: dependency relationships (imports, renders, styles) with annotations
- **Meta**: generation timestamp, node/edge counts, tool versions

See [mindmap-output.json](mindmap-output.json) for a complete example.

## Tech Stack

- **MCP SDK** — `@modelcontextprotocol/sdk` for tool registration and stdio transport
- **Tree-sitter** — `web-tree-sitter` for multi-language AST parsing
- **Zod** — Input schema validation
- **TypeScript** — MCP server implementation
- **Vanilla JS** — Frontend visualization (no framework dependency)

## License

MIT
