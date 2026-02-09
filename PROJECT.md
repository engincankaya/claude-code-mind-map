# Mind Map Generator — Project Overview

Architecture-aware mind map generator for code repositories. A Claude Code plugin that combines deterministic tools (Tree-sitter parsing, graph construction) with LLM intelligence (architecture recognition, file classification, semantic grouping) to produce meaningful codebase visualizations.

> **Tools extract facts. The LLM understands meaning.**

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Architecture](#2-architecture)
3. [MCP Server](#3-mcp-server)
4. [Plugin Ecosystem](#4-plugin-ecosystem-claude-code-integration)
5. [Frontend](#5-frontend)
6. [Data Flow](#6-end-to-end-data-flow)
7. [Tech Stack](#7-tech-stack)
8. [Getting Started](#8-getting-started)

---

## 1. Purpose

Modern codebases are complex. File trees show structure but not meaning. This project generates **architecture-aware mind maps** that show:

- How a codebase is organized architecturally (not just by folders)
- What each file's role is (service, controller, model, util, config...)
- How files relate to each other (imports, implements, events, DI...)
- Which files are architecturally critical vs. peripheral
- Where architectural boundaries exist and where they're crossed

The key insight: a tool can tell you "file X imports from file Y." Only an LLM can tell you "file X is an authentication middleware that guards the API layer."

### What Makes This Different

| Traditional | This Project |
|------------|-------------|
| File tree / folder view | Semantic architecture groups |
| Static dependency graphs | LLM-classified relationships with annotations |
| Language-specific tools | Multi-language via Tree-sitter (TS, Python, Go, Rust, Java) |
| Manual documentation | Auto-generated, queryable knowledge graph |

---

## 2. Architecture

The system has three layers:

```
┌──────────────────────────────────────────────────────┐
│           Claude Code (LLM Orchestrator)              │
│                                                       │
│  Commands:  /mindmap  /explain  /impact               │
│  Agents:    mindmap-agent, architect, onboard, impact  │
│  Skills:    mindmap-rules, architecture-aware          │
│                                                       │
│  The LLM is the BRAIN — it interprets, classifies,   │
│  groups, and makes all architectural judgments.        │
└──────────────┬────────────────────────────────────────┘
               │ calls MCP tools
               ▼
┌──────────────────────────────────────────────────────┐
│              MCP Server (TypeScript)                   │
│                                                       │
│  8 tools: scan, resolve, context, parse,              │
│           sample, build, validate, publish             │
│                                                       │
│  Zero LLM logic. Pure data in, pure data out.         │
│  In-memory Artifact Store for token efficiency.       │
└──────────────┬────────────────────────────────────────┘
               │ produces mindmap-output.json
               ▼
┌──────────────────────────────────────────────────────┐
│              Frontend (Vanilla JS)                     │
│                                                       │
│  Interactive mind map viewer:                          │
│  - Tree layout with root → groups → files             │
│  - Collapsible group nodes                            │
│  - Click-to-explain detail cards                      │
│  - Pan, zoom, keyboard shortcuts                      │
└──────────────────────────────────────────────────────┘
```

---

## 3. MCP Server

The MCP (Model Context Protocol) server is the deterministic backbone. It provides 8 tools that Claude orchestrates to generate mind maps. Located in `mcp-server/`.

### 3.1 Tools

| Tool | Purpose | Input | Output |
|------|---------|-------|--------|
| **scan** | List repository files | rootPath, ignore patterns | File list + stats |
| **resolve** | Canonicalize paths, produce stable IDs | File list | fileId, contentHash, language per file |
| **context** | Extract project metadata | rootPath | README, package managers, configs, folder structure |
| **parse** | Parse source with Tree-sitter | Files, depth level | Imports, exports, symbols (stored in artifact store) |
| **sample** | Read code snippet | fileId, line range | Source code content |
| **build** | Construct mind map graph | ArchitecturePlan + parseArtifactId | MindMapJSON (stored in artifact store) |
| **validate** | Check graph integrity | mindmapArtifactId | Errors, warnings, repair hints |
| **publish** | Emit final output | All artifact IDs | Bundled JSON + disk write |

### 3.2 Artifact Store

Large data objects (ParseResult, MindMapJSON, ValidationReport) are stored server-side in an in-memory artifact store. The LLM only receives compact summaries + `artifactId` references. This reduces token usage by ~75-87%.

```
WITHOUT Artifact Store:  ~64K tokens for a 56-file project
WITH Artifact Store:     ~16K tokens  (75% savings)
```

### 3.3 Tree-sitter Multi-Language Support

Parsing uses Web Tree-sitter with language-specific normalizers:

```
mcp-server/src/languages/
  registry.ts              — language detection & registration
  types.ts                 — unified import/export/symbol types
  typescript/normalizer.ts — TypeScript/JavaScript/JSX/TSX
  python/normalizer.ts     — Python
  go/normalizer.ts         — Go
  rust/normalizer.ts       — Rust
  java/normalizer.ts       — Java
```

Each normalizer implements the same interface:
- `extractImports()` — find import/require/use statements
- `extractExports()` — find exported symbols
- `extractSymbols()` — find classes, functions, types, etc.

Three parse depth levels for token efficiency:
- **summary** — line counts, import/export counts, symbol stats (all files)
- **standard** — full imports, exports, symbol list (key files)
- **detailed** — signatures, decorators, docstrings (critical files only)

### 3.4 MindMapJSON Output Schema

The final output (`mindmap-output.json`) contains:

```typescript
{
  meta: { generatedAt, rootPath, nodeCount, edgeCount, ... },
  nodes: [{
    id, label, kind,        // "root" | "group" | "file"
    type,                   // LLM-assigned: "service", "controller", "config"...
    parentId,
    metadata: { canonicalPath, language, importance, role },
    confidence              // LLM's classification confidence (0-1)
  }],
  edges: [{
    id, source, target,
    rels,                   // ["imports", "implements", "uses", ...]
    label,
    metadata: { importedSymbols, annotation }
  }]
}
```

### 3.5 Key Design Rules

- **Never `console.log()`** in MCP server — corrupts JSON-RPC stdio. Use `console.error()`.
- Tools make **zero interpretive decisions** — no heuristic scoring, no file classification.
- Stable IDs: same file always produces same fileId (SHA-256 of canonical path).
- Publish is **mandatory** — the agent must always call `mindmap.publish` as the final step.

---

## 4. Plugin Ecosystem (Claude Code Integration)

The project integrates with Claude Code through convention-based discovery in the `.claude/` directory.

### 4.1 Commands (`/slash` commands)

Commands are single-turn prompt templates. User types `/command`, Claude receives the expanded prompt.

| Command | File | What It Does |
|---------|------|-------------|
| `/mindmap` | `.claude/commands/mindmap.md` | Generates a full architecture mind map using the 8-tool pipeline |
| `/explain <file>` | `.claude/commands/explain.md` | Explains a file's architectural role from the mind map |
| `/impact <file>` | `.claude/commands/impact.md` | Analyzes blast radius of changing a file |

Commands use `$ARGUMENTS` placeholder for user input.

### 4.2 Agents (Multi-turn specialists)

Agents are multi-turn assistants with tool access. Defined with YAML frontmatter in `.claude/agents/*.md`.

| Agent | File | Tools | Purpose |
|-------|------|-------|---------|
| **mindmap-agent** | `mindmap-agent.md` | All 8 MCP tools | Orchestrates mind map generation (the core pipeline) |
| **architect-agent** | `architect-agent.md` | All 8 MCP tools + Read, Glob, Grep | Architecture-aware coding assistant using the knowledge graph |
| **onboard-agent** | `onboard-agent.md` | sample + Read, Glob, Grep | Interactive project tour for new developers |
| **impact-agent** | `impact-agent.md` | sample, parse + Read, Glob, Grep | Change impact analysis with risk assessment |

### 4.3 Skills (Passive context)

Skills inject rules and context into Claude's behavior. No frontmatter needed.

| Skill | File | Purpose |
|-------|------|---------|
| **mindmap-rules** | `.claude/skills/mindmap-rules.md` | Stable ID rules, evidence requirements, artifact store flow, mandatory publish |
| **architecture-aware** | `.claude/skills/architecture-aware.md` | Teaches Claude to use `mindmap-output.json` when answering questions |

### 4.4 MCP Server Registration

`.mcp.json` registers the MCP server for Claude Code:

```json
{
  "mcpServers": {
    "mindmap": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"]
    }
  }
}
```

Claude Code spawns the server as a child process (stdio transport). Tools are callable as `mcp__mindmap__<tool>` (double underscore naming convention).

---

## 5. Frontend

An interactive mind map viewer in `frontend/`. Pure vanilla HTML/CSS/JS — no build tools, no framework.

### 5.1 Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page app shell |
| `styles.css` | NotebookLM-inspired dark theme |
| `app.js` | All rendering, interaction, and data logic |

### 5.2 Features

**Tree Layout**
- 3-column horizontal tree: Root → Groups → Files
- Automatic positioning with vertical centering
- SVG bezier curve edges with draw-on animation

**Collapsible Groups**
- Group nodes (2nd column) start collapsed by default
- Click to expand/collapse with animated chevron toggle
- File count badge shown when collapsed

**Detail Cards (Click-to-Explain)**
- Click any file node to see an architecture analysis card
- Card shows: Role, Group, Importance, Language, Confidence
- Outgoing dependencies with relationship type badges (imports, implements, uses)
- Incoming dependents with annotations
- Cross-group boundary warnings
- Summary insight sentence
- Connected to source node with dashed purple edge
- Click on dependency names to highlight those nodes

**Navigation**
- Pan by scrolling, zoom with Ctrl+wheel
- Fit to screen (F key or button)
- Zoom in/out (+/- keys or buttons)
- Escape to close detail cards
- Click empty space to dismiss cards

**Tooltip**
- Hover any node for quick info
- Shows: full label, canonical path, role, importance, language, confidence

### 5.3 Design

NotebookLM-inspired aesthetic:
- Root node: `#5b5d8f` (muted purple)
- Group nodes: `#374151` (dark gray)
- File nodes: `#1a5c3a` (forest green)
- Detail cards: `#1e293b` (slate dark) with section separators
- Edges: `#94a3b8` (slate gray), detail edges: `#6366f1` (indigo dashed)

### 5.4 Data Source

Reads `mindmap-output.json` (generated by `/mindmap` command) via fetch. Can be pointed to any mind map JSON via `?data=path` URL parameter.

---

## 6. End-to-End Data Flow

### Mind Map Generation (`/mindmap`)

```
User: /mindmap

Phase 1 — Discovery
  scan()     → 31 files found
  resolve()  → stable IDs, languages detected
  context()  → package.json, tsconfig, folder structure

Phase 2 — Extraction
  parse(depth=summary)   → all files: line counts, import/export stats
  parse(depth=standard)  → key files: full imports, exports, symbols

Phase 3 — Interpretation (LLM does the thinking)
  LLM analyzes all data → produces ArchitecturePlan:
    - Architecture: "MCP tool server with Tree-sitter multi-language parsing"
    - 6 groups: Server Core, Pipeline Tools, Language Normalizers, ...
    - 22 file classifications with roles and importance
    - Relationship annotations

Phase 4 — Construction
  build(plan + parseArtifactId) → MindMapJSON stored (33 nodes, 41 edges)

Phase 5 — Validation
  validate() → 0 errors, 0 warnings ✓

Phase 6 — Publication
  publish() → writes mindmap-output.json to disk
```

### Node Explanation (click in frontend or `/explain`)

```
User clicks file node in frontend
  → computeExplain(node) runs client-side
  → Traces edges in mindmap-output.json
  → Shows detail card with:
     Role, Group, Importance, Dependencies,
     Dependents, Cross-group connections, Summary
```

### Impact Analysis (`/impact`)

```
User: /impact parse.ts
  → Claude reads mindmap-output.json
  → Traces 1-hop and 2-hop dependents
  → Identifies cross-group impacts
  → Returns risk assessment + suggested actions
```

---

## 7. Tech Stack

### MCP Server
- **Runtime**: Node.js 20+
- **Language**: TypeScript (ESM)
- **MCP SDK**: `@modelcontextprotocol/sdk` with Zod schemas
- **Parsing**: `web-tree-sitter` with language-specific grammars
- **File discovery**: `fast-glob`
- **IDs**: `uuid` v4 for artifacts, SHA-256 for file IDs

### Frontend
- **HTML/CSS/JS**: Vanilla, no build tools
- **Layout**: Custom tree layout algorithm (horizontal, left-to-right)
- **Rendering**: DOM nodes + SVG edges
- **Styling**: Custom CSS (NotebookLM-inspired)

### Claude Code Integration
- **Commands**: Markdown with `$ARGUMENTS`
- **Agents**: Markdown with YAML frontmatter (`name`, `description`, `tools`)
- **Skills**: Pure markdown (no frontmatter)
- **MCP registration**: `.mcp.json` (stdio transport)

---

## 8. Getting Started

### Build the MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### Run the Frontend

```bash
cd frontend
python3 -m http.server 8080
# Open http://localhost:8080
```

### Generate a Mind Map

In Claude Code (with this project open):

```
/mindmap
```

This runs the full 8-tool pipeline and writes `mindmap-output.json`.

### Query the Mind Map

```
/explain parse.ts        # Explain a file's architectural role
/impact build.ts         # Analyze change impact
```

### Project Structure

```
mind-map/
  .mcp.json                         # MCP server registration
  .claude/
    commands/
      mindmap.md                    # /mindmap command
      explain.md                    # /explain command
      impact.md                     # /impact command
    agents/
      mindmap-agent.md              # Mind map generation orchestrator
      architect-agent.md            # Architecture-aware coding assistant
      onboard-agent.md              # New developer onboarding guide
      impact-agent.md               # Change impact analyzer
    skills/
      mindmap-rules.md              # Generation rules & constraints
      architecture-aware.md         # Teaches Claude to use the knowledge graph
  mcp-server/
    src/
      index.ts                      # MCP server entry point
      types.ts                      # Shared TypeScript types
      tools/
        scan.ts                     # File discovery
        resolve.ts                  # Path canonicalization & IDs
        context.ts                  # Project metadata extraction
        parse.ts                    # Tree-sitter multi-language parsing
        sample.ts                   # Code snippet reader
        build.ts                    # Graph construction
        validate.ts                 # Graph integrity validation
        publish.ts                  # Final output emission
      languages/
        registry.ts                 # Language detection
        types.ts                    # Unified parse output types
        typescript/normalizer.ts    # TS/JS/JSX/TSX
        python/normalizer.ts        # Python
        go/normalizer.ts            # Go
        rust/normalizer.ts          # Rust
        java/normalizer.ts          # Java
      lib/
        artifact-store.ts           # In-memory artifact store
        tree-sitter-loader.ts       # Grammar loader
        hashing.ts                  # SHA-256 utilities
  frontend/
    index.html                      # App shell
    styles.css                      # NotebookLM-inspired theme
    app.js                          # Viewer logic
  mindmap-output.json               # Generated mind map data
  PLAN_V2.md                        # Full architecture plan
  RESEARCH.md                       # Claude Code extensibility research
```
