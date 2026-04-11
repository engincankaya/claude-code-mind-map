# Mind Map Generator

Architecture-aware mind map generator for code repositories.

A Claude Code plugin that combines **deterministic code analysis (Tree-sitter + MCP)** with **LLM reasoning** to build a structured, interactive representation of your codebase.

<img width="1512" height="783" alt="mind-map" src="https://github.com/user-attachments/assets/91f5c112-eb24-4a24-8731-1f2c34bf935b" />

---

## Why This Exists

Most tools analyze code statically.

This project goes further:

* Turn your codebase into a **structured architecture graph**
* Keep it understandable at **file, module, and system level**
* Use it as a foundation for **LLM-powered development workflows**

> This is not just a visualization tool —
> it’s the foundation for **architecture-aware coding systems**.

---

## Overview

This project is a **monorepo** with three core parts:

* **MCP Server (TypeScript)**
  Deterministic pipeline that extracts structure from the codebase

* **Frontend**
  Interactive visualization layer for exploring the graph

* **Claude Code Integration**
  Agents and commands that orchestrate the system

---

## Core Principle

> **Tools extract facts. The LLM understands meaning.**

* MCP tools → deterministic, reproducible outputs
* LLM → interprets structure and builds architectural understanding

This separation ensures:

* Reliability
* Token efficiency
* High-quality reasoning

---

## Architecture

```
┌──────────────────────────────────────────────┐
│           Claude Code (LLM Agent)            │
│  Orchestrates phases, interprets data,       │
│  makes architectural decisions               │
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
│  │  Stores pipeline results by ID         │  │
│  │  ~75–87% token savings                │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

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
| `mindmap.overview` | Read a mind map JSON from disk and return an LLM-friendly project summary (minimal/standard/detailed) |

## Language Support

Powered by Tree-sitter:

* TypeScript / JavaScript / TSX / JSX
* Python
* Go
* Rust
* Java

All languages are normalized into a **unified structure model**.

---

## Usage

### Generate a Mind Map

```bash
/mindmap /path/to/your/project
```

---

### Available Commands

| Command    | Description                 |
| ---------- | --------------------------- |
| `/mindmap` | Generate architecture graph |
| `/explain` | Explain a file/component    |
| `/impact`  | Analyze change impact       |

---

### Available Agents

| Agent             | Description                  |
| ----------------- | ---------------------------- |
| `mindmap-agent`   | Runs full pipeline           |
| `architect-agent` | Architecture-aware assistant |
| `impact-agent`    | Dependency analysis          |
| `onboard-agent`   | Project onboarding           |

---

## Frontend Visualization

Open:

```
frontend/index.html
```

Features:

* Interactive tree layout
* Collapsible nodes
* Dependency graph
* Zoom / pan
* Detail panels
* Dark theme

---

## Output Format

Structured graph (MindMapJSON):

* **Nodes**

  * root, group, file, symbol
  * metadata: role, importance, confidence

* **Edges**

  * dependencies (imports, calls, structure)

* **Meta**

  * timestamps, versions, stats

---

## Tech Stack

TypeScript — MCP SDK — Tree-sitter — Zod — Vanilla JS

---

## Future Vision

### Incremental Mind Map (Git-Aware)

The system will evolve into a **continuously updated architecture graph**:

* On every commit:

  * Only affected nodes are updated
  * Dependencies are recalculated incrementally
* The graph always reflects the **latest state of the codebase**
* The repository becomes a **living documentation system**

---

### Node-Centric LLM Context Engine

This enables a new workflow:

1. Select a node (file / module / symbol)
2. Request a change (“update this logic”)
3. System gathers:

   * Related nodes
   * Dependencies
   * Relevant files
   * Architectural context

This context is passed to an LLM, enabling:

* Context-aware code generation
* Strong consistency across the system
* Minimal token usage
* Safer refactoring

---

### Why This Matters

This transforms the system into:

* A **real-time architecture memory layer**
* A **context engine for LLM coding**
* A bridge between:

  * deterministic code understanding (MCP + Tree-sitter)
  * semantic reasoning (LLMs)

---

## Development

```bash
cd mcp-server

npm install
npm run dev
npm test
npm run lint
```

---

## License

MIT
