# Mind Map Generator — Revised Architecture Plan (v2)

## 1. Vision

Build a Claude Code plugin that generates **meaningful, architecture-aware mind maps** for **any** code repository, regardless of programming language. The system combines deterministic tools (data extraction, graph construction, validation) with LLM intelligence (interpretation, classification, architectural reasoning) — each doing what it does best.

### Core Principle

> **Tools extract facts. The LLM understands meaning.**

A tool can tell you "file X imports from file Y." Only an LLM can tell you "file X is an authentication middleware that guards the API layer."

---

## 2. Goals & Non-Goals

### Goals
- Generate architecture-aware mind maps for repositories in **any language** (via Tree-sitter).
- Use deterministic tools for all mechanical/computational work (scanning, parsing, graph construction, validation, publishing).
- Use the LLM for all **interpretive** work (architecture recognition, file classification, semantic grouping, relationship discovery, importance ranking).
- Emit final output via `mindmap.publish` — never as raw chat text.
- Produce stable, reproducible results (same repo state → same IDs).
- Support hierarchical analysis (folder → file → symbol) for token efficiency.

### Non-Goals
- No frontend/UI — only frontend-friendly structured output.
- No graph layout algorithms — that's a frontend concern.
- No real-time/watch mode in v1.
- No cross-repository analysis in v1.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Claude Code Subagent                      │
│                   ("MindMap Agent" - LLM)                    │
│                                                              │
│  The agent is the BRAIN. It orchestrates phases, interprets  │
│  data, makes architectural judgments, and drives the entire  │
│  workflow. Tools are its hands and eyes.                     │
└──────────┬──────────────────────────────────┬───────────────┘
           │ calls tools                      │ receives results
           ▼                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     MCP Tool Server                          │
│                  (TypeScript, deterministic)                  │
│                                                              │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐ │
│  │  scan     │ │  resolve  │ │  context  │ │  parse       │ │
│  │ (files)   │ │ (IDs)     │ │ (project) │ │ (Tree-sitter)│ │
│  └──────────┘ └───────────┘ └───────────┘ └──────────────┘ │
│  ┌──────────┐ ┌───────────┐ ┌───────────┐ ┌──────────────┐ │
│  │  sample   │ │  build    │ │  validate │ │  publish     │ │
│  │ (snippet) │ │ (graph)   │ │ (check)   │ │ (output)     │ │
│  └──────────┘ └───────────┘ └───────────┘ └──────────────┘ │
│                                                              │
│  Zero LLM logic inside. Pure data in, pure data out.        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Artifact Store (In-Memory)                 │  │
│  │  Holds ParseResult, ArchitecturePlan, MindMapJSON,     │  │
│  │  ValidationReport. Tools write/read by artifactId.     │  │
│  │  LLM only sees summaries + artifactIds.                │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Server-Side State — The Artifact Store

**Problem:** Without server-side state, the full MindMapJSON (~8-15K tokens) must travel through the LLM context 3 times (build → validate → publish), and the ArchitecturePlan (~3-5K tokens) also repeats. For a 500-file repo this wastes **~27K+ tokens** on pure data repetition.

**Solution:** The MCP server maintains an **in-memory artifact store**. Large data objects are stored server-side and referenced by `artifactId`. The LLM only receives compact summaries.

```
┌─────────────────────────────────────────────────────────┐
│                    Token Flow Comparison                   │
│                                                           │
│  WITHOUT Artifact Store:                                  │
│  build() → full MindMapJSON (12K) → LLM context          │
│  validate(full MindMapJSON) → LLM sends 12K again        │
│  publish(full MindMapJSON + plan + validation) → 20K+     │
│  Total repeated data: ~27K tokens                         │
│                                                           │
│  WITH Artifact Store:                                     │
│  build() → { artifactId, summary (200 tokens) }          │
│  validate({ artifactId }) → 50 tokens                    │
│  publish({ artifactId }) → 50 tokens                     │
│  Total repeated data: ~300 tokens                         │
│                                                           │
│  Savings: ~90% reduction in data repetition               │
└─────────────────────────────────────────────────────────┘
```

#### Artifact Store Design

```typescript
// lib/artifact-store.ts

interface ArtifactEntry {
  id: string;                    // uuid v4
  type: "parse-result" | "architecture-plan" | "mindmap" | "validation-report";
  data: unknown;                 // the full object
  createdAt: string;
  summary: Record<string, unknown>;  // compact summary for LLM
}

class ArtifactStore {
  private store = new Map<string, ArtifactEntry>();

  put(type: ArtifactEntry["type"], data: unknown, summary: Record<string, unknown>): string;
  get(id: string): ArtifactEntry | undefined;
  getSummary(id: string): Record<string, unknown> | undefined;
  getTyped<T>(id: string, type: ArtifactEntry["type"]): T | undefined;
  delete(id: string): boolean;
  clear(): void;
}
```

#### How Tools Use the Store

| Tool | Writes to Store | Reads from Store |
|------|----------------|-----------------|
| `mindmap.parse` | Stores `ParseResult`, returns `artifactId` + summary | — |
| `mindmap.build` | Stores `MindMapJSON`, returns `artifactId` + summary | Reads `ParseResult` by artifactId |
| `mindmap.validate` | Stores `ValidationReport`, returns `artifactId` + report | Reads `MindMapJSON` by artifactId |
| `mindmap.publish` | — | Reads all artifacts by artifactIds |
| `mindmap.scan` | Does NOT use store (output is small) | — |
| `mindmap.resolve` | Does NOT use store (output needed by LLM) | — |
| `mindmap.context` | Does NOT use store (output needed by LLM) | — |
| `mindmap.sample` | Does NOT use store (output needed by LLM) | — |

**Rule:** Tools that produce data the LLM needs to **interpret** (scan, resolve, context, sample) return full output. Tools that produce data the LLM only needs to **pass along** (parse results for build, mindmap for validate, everything for publish) use the artifact store.

#### Artifact Lifetime

- Artifacts live for the duration of a single mind map generation session.
- When `mindmap.publish` is called, all artifacts for that session are bundled and optionally written to disk, then cleared from memory.
- If the agent needs to rebuild (validation failure), old artifacts are replaced by new ones.

---

## 4. The LLM / Tool Responsibility Split

This is the most important design decision in the system.

### What Tools Do (Deterministic)

| Responsibility | Why Tool? |
|---|---|
| List files in repo | Pure IO — `glob` / `readdir` |
| Normalize paths, produce stable hashes | Pure computation |
| Detect languages | File extension + Tree-sitter detection |
| Parse AST (imports, exports, symbols) | Tree-sitter is deterministic |
| Extract raw structural facts | No judgment needed |
| Read file snippets on demand | Pure IO |
| Extract project metadata (package.json, go.mod, etc.) | Pure IO + simple parsing |
| Build graph mechanically from a plan | Applying rules, no judgment |
| Validate graph structural integrity | Graph algorithms |
| Publish final output | Serialization + IO |

### What the LLM Does (Intelligent)

| Responsibility | Why LLM? |
|---|---|
| Recognize architecture patterns (MVC, Clean, Hexagonal, Microservice...) | Requires understanding of software design |
| Classify file roles (service, controller, model, util, config, test...) | Naming conventions vary wildly across projects |
| Create semantic groupings ("Authentication", "Data Access", "API Layer") | Requires understanding intent, not just structure |
| Discover hidden relationships (event-driven, DI, config-driven) | Cannot be inferred from import graphs alone |
| Rank importance (core vs peripheral) | Requires judgment about what matters |
| Name groups meaningfully | Requires natural language understanding |
| Decide on presentation (which view suits this project?) | Requires understanding the audience |
| Handle ambiguity and edge cases | Rule-based systems fail on edge cases |
| Review validation results and decide repair strategy | Strategic decision, not mechanical |

### The Golden Rule

> If a task requires **judgment, interpretation, or understanding of intent** → LLM.
> If a task requires **computation, IO, or rule application** → Tool.

---

## 5. Phase-Based Workflow

The agent operates as a **phase-based state machine**. Each phase has a clear purpose and clear tool/LLM boundaries.

### Phase 1: Discovery

**Purpose:** Understand what we're working with.

```
Agent calls:  mindmap.scan  → file list
Agent calls:  mindmap.resolve → canonical paths, stable IDs, file metadata
Agent calls:  mindmap.context → project metadata (README, package files, config)
```

**LLM role in this phase:** Minimal. Just orchestration — call the tools, receive results.

---

### Phase 2: Extraction

**Purpose:** Extract raw structural facts from source code.

```
Agent calls:  mindmap.parse(depth="summary") → per-file summary stats
```

For a large repo (500+ files), the agent gets a lightweight overview first:
- Number of imports/exports per file
- Symbol counts and kinds
- Detected language
- File size

**LLM role in this phase:** Read the summary. Identify which areas/folders look architecturally significant and which can be treated as bulk. Decide where to request deeper parsing.

```
Agent calls:  mindmap.parse(depth="standard", files=[...]) → detailed parse for key files
Agent calls:  mindmap.parse(depth="detailed", files=[...]) → full detail for critical files
```

This **hierarchical parsing** strategy keeps token usage manageable even for huge repos.

---

### Phase 3: Interpretation (LLM-Driven — The Core Phase)

**Purpose:** Understand the codebase's architecture and meaning.

This is where the LLM does its most important work. No tools are called here (except optionally `mindmap.sample` to read specific code snippets for clarification).

The LLM receives:
- Project context (from Phase 1)
- Parsed structural data (from Phase 2)

The LLM produces an **ArchitecturePlan** (strict JSON) containing:

1. **Architecture Pattern Recognition**
   - "This is a NestJS backend following a modular architecture with domain-driven grouping"
   - "This is a React frontend with Redux state management and a feature-based folder structure"

2. **File Role Classifications**
   - Each file gets a `role` and `confidence` assigned by the LLM
   - Roles: service, controller, model, repository, middleware, hook, component, page, util, config, test, migration, script, type-definition, etc.

3. **Semantic Groups**
   - Groups represent architectural concepts, not just folders
   - Example: "Authentication" group containing files from `src/auth/`, `src/middleware/auth.ts`, `src/guards/`, `config/jwt.ts`
   - Each group has a meaningful label, a kind (layer/domain/feature/infrastructure), and member files

4. **Relationship Annotations**
   - Beyond import edges: "these files collaborate via event bus", "this controller delegates to this service via DI"
   - Conceptual relationships that can't be seen in the AST

5. **Importance Rankings**
   - Which files/groups are architecturally central?
   - Which are peripheral (utils, generated code, boilerplate)?

6. **Presentation Decisions**
   - View type: `layer_then_domain`, `domain_then_layer`, `flat`, or custom
   - Collapse rules: "collapse all test files under a single node unless focused on testing"
   - Edge aggregation policy

If the LLM encounters ambiguous files, it can call `mindmap.sample` to read a code snippet:

```
Agent calls:  mindmap.sample(fileId, startLine, endLine) → code snippet
Agent reasons: "Ah, this file sets up Redis pub/sub — it's an event bus infrastructure component"
```

---

### Phase 4: Construction

**Purpose:** Mechanically build the mind map graph from the LLM's plan.

```
Agent calls:  mindmap.build(plan=ArchitecturePlan, parseArtifactId=<id>, resolvedFiles=ResolvedFiles, policy=EdgePolicy)
Returns:      { artifactId: "mm-xxx", summary: { nodes: 47, edges: 83, groups: 8, ... } }
```

The `build` tool is **purely mechanical**. It:
- Reads ParseResult from the artifact store (by `parseArtifactId`)
- Creates nodes according to the plan's groups and placements
- Creates edges from import data + LLM-annotated relationships
- Applies edge aggregation rules
- Applies collapse rules
- Assigns stable IDs to all nodes/edges
- **Stores the full MindMapJSON in the artifact store** (NOT sent to LLM)
- Returns only `artifactId` + compact summary to the LLM

**The build tool does NOT interpret anything.** It just applies the plan.

---

### Phase 5: Validation & Refinement

**Purpose:** Ensure graph integrity and fix issues.

```
Agent calls:  mindmap.validate(mindmapArtifactId=<id>)
Returns:      { artifactId: "vr-xxx", isValid: true, summary: { errors: 0, warnings: 2, ... } }
```

The validation tool:
- Reads the full MindMapJSON from the artifact store (by `mindmapArtifactId`)
- Checks orphan nodes, broken edges, cycles, duplicate IDs, schema conformance
- **Stores the full ValidationReport in the artifact store**
- Returns `artifactId` + the full validation report to the LLM (reports are small enough)

**LLM role:** Review the validation report. If there are issues:
- Decide whether to adjust the ArchitecturePlan (re-group, re-classify)
- Or adjust the edge policy (different aggregation)
- Re-run build + validate (max 2 repair iterations)

The LLM decides the **strategy**; the tools execute it.

---

### Phase 6: Publication

**Purpose:** Emit the final result.

```
Agent calls:  mindmap.publish(mindmapArtifactId=<id>, validationArtifactId=<id>, options={...})
```

The publish tool reads all artifacts from the store by their IDs — no need for the LLM to pass the full data.

**Hard rule:** The agent MUST call `mindmap.publish`. Never print the mind map as chat text.

---

## 6. Tool Contracts

### Tool 1: `mindmap.scan`

**Purpose:** List files in repo deterministically.

```typescript
// Input
{
  rootPath: string;
  ignore?: string[];         // glob patterns to ignore
  maxFiles?: number;         // safety limit (default 10000)
}

// Output: RawFileList
{
  rootPath: string;
  files: string[];           // relative paths from rootPath
  stats: {
    total: number;
    included: number;
    ignored: number;
  }
}
```

Default ignores: `node_modules`, `.git`, `dist`, `build`, `coverage`, `__pycache__`, `.venv`, `vendor`, `target` (Rust), `bin/obj` (.NET).

---

### Tool 2: `mindmap.resolve`

**Purpose:** Canonicalize file paths, produce stable IDs and content hashes.

```typescript
// Input
{
  rootPath: string;
  files: string[];           // from scan output
}

// Output: ResolvedFiles
{
  rootPath: string;
  files: Array<{
    fileId: string;          // stable hash of canonicalPath
    absolutePath: string;
    canonicalPath: string;   // workspace-relative, normalized
    contentHash: string;     // hash of file content
    ext: string;
    language: string;        // detected via extension mapping
    sizeBytes: number;
  }>;
}
```

**No classification here.** No `isSource`, `isTest`, `isConfig` — that's the LLM's job. The tool only provides raw facts.

---

### Tool 3: `mindmap.context` *(NEW)*

**Purpose:** Extract project-level metadata to help the LLM understand the project.

```typescript
// Input
{
  rootPath: string;
}

// Output: ProjectContext
{
  rootPath: string;
  projectFiles: {
    readme?: string;              // README content (truncated to ~3000 chars)
    packageManagers: Array<{
      type: "npm" | "cargo" | "go" | "pip" | "maven" | "gradle" | "composer" | "mix" | "gem" | "nuget" | "other";
      filePath: string;
      name?: string;
      dependencies?: string[];    // dependency names only, no versions
      scripts?: Record<string, string>;
    }>;
    configs: Array<{
      filePath: string;
      type: "tsconfig" | "eslint" | "prettier" | "docker" | "ci" | "other";
      summary: string;            // brief description of what this config does
    }>;
    entryPoints: string[];        // detected entry points (main, index, app, etc.)
  };
  folderStructure: {
    topLevelDirs: string[];
    maxDepth: number;
    totalDirs: number;
  };
  repoMeta: {
    primaryLanguages: Array<{ language: string; fileCount: number; percentage: number }>;
    totalFiles: number;
    totalSizeBytes: number;
  };
}
```

This gives the LLM the "big picture" before diving into file-level analysis.

---

### Tool 4: `mindmap.parse`

**Purpose:** Parse source files using Tree-sitter and extract raw structural facts. **No heuristics, no classification, no scoring.**

Supports **pagination** for large repos — parse in batches rather than all at once.

```typescript
// Input
{
  rootPath: string;
  files: Array<{
    fileId: string;
    absolutePath: string;
    canonicalPath: string;
    language: string;
  }>;
  depth: "summary" | "standard" | "detailed";
  options?: {
    maxSymbolsPerFile?: number;  // default 50
    includeEvidence?: boolean;   // default true
    batchSize?: number;          // default 100, max files per call
    cursor?: string;             // pagination cursor from previous call
    appendToArtifact?: string;   // artifactId to append results to (for multi-batch)
  };
}

// Output: ParseResult
{
  artifactId: string;            // stored in artifact store (for build to read)
  files: Array<FileParseResult>; // also returned to LLM (for interpretation)
  unresolvedImports: Array<{
    fromFileId: string;
    rawSpecifier: string;
  }>;
  pagination?: {
    cursor: string;              // pass to next call to continue
    hasMore: boolean;
    processedCount: number;
    totalCount: number;
  };
  parserMeta: {
    treeSitterVersion: string;
    languagesUsed: string[];
    parseErrors: Array<{ fileId: string; error: string }>;
  };
}
```

**Pagination flow for large repos:**
```
Call 1: parse(files=[all 500], depth="summary", batchSize=200)
  → Returns first 200 summaries + artifactId "pr-abc" + cursor
Call 2: parse(files=[all 500], depth="summary", cursor="...", appendToArtifact="pr-abc")
  → Appends next 200 to same artifact + new cursor
Call 3: parse(files=[all 500], depth="summary", cursor="...", appendToArtifact="pr-abc")
  → Appends final 100, hasMore=false
```

For `depth="summary"`, the full file list IS returned to the LLM (summaries are small — ~100 tokens/file). For `depth="standard"` and `depth="detailed"`, full results are also returned since the agent selectively parses only key files (typically 10-30 files).
```

**`depth="summary"` output per file:**
```typescript
{
  fileId: string;
  canonicalPath: string;
  language: string;
  stats: {
    lines: number;
    importCount: number;
    exportCount: number;
    symbolCount: number;
    symbolKinds: Record<string, number>;  // e.g. { "class": 2, "function": 5 }
  };
}
```

**`depth="standard"` output per file:**
```typescript
{
  fileId: string;
  canonicalPath: string;
  language: string;
  imports: Array<{
    rawSpecifier: string;
    kind: "static" | "dynamic";
    importedSymbols: string[];        // named imports; ["*"] for wildcard
    resolvedTargetFileId?: string;    // if resolvable within repo
  }>;
  exports: Array<{
    kind: "named" | "default" | "re-export";
    exportedSymbols: string[];
  }>;
  symbols: Array<{
    symbolId: string;                 // hash(fileId + kind + name)
    kind: "class" | "function" | "interface" | "type" | "enum" |
          "variable" | "struct" | "trait" | "impl" | "module" | "other";
    name: string;
    visibility: "public" | "private" | "protected" | "internal" | "unknown";
    evidence: { startLine: number; endLine: number };
  }>;
}
```

**`depth="detailed"` adds to standard:**
```typescript
{
  // ...all of standard, plus:
  symbols: Array<{
    // ...all of standard symbol fields, plus:
    signature?: string;              // function signature, class declaration line
    decorators?: string[];           // @Controller, @Injectable, etc.
    typeAnnotations?: string[];      // key type references
    docComment?: string;             // JSDoc / docstring (truncated)
  }>;
  reExports: Array<{
    fromSpecifier: string;
    symbols: string[];
  }>;
}
```

**Key design decisions:**
- **No heuristic scores.** The LLM interprets raw data directly.
- **Three depth levels** for token efficiency. Agent decides depth per file batch.
- **Language-agnostic output format.** Tree-sitter grammars handle language differences; output is unified.
- **Evidence included** so the LLM can reference specific line ranges.

---

### Tool 5: `mindmap.sample` *(NEW)*

**Purpose:** Read a code snippet from a specific file. Used by the LLM during interpretation when it needs to see actual code to understand a file's purpose.

```typescript
// Input
{
  rootPath: string;
  fileId: string;
  absolutePath: string;
  startLine?: number;        // default 1
  endLine?: number;          // default 50
  maxLines?: number;         // safety limit, default 100
}

// Output
{
  fileId: string;
  canonicalPath: string;
  language: string;
  content: string;           // the code snippet
  totalLines: number;
  range: { startLine: number; endLine: number };
}
```

This is a **helper tool** for the LLM's interpretation phase. The LLM uses it selectively — not for every file, only when structural data alone isn't enough to understand a file's role.

---

### Tool 6: `mindmap.build`

**Purpose:** Mechanically construct the mind map graph from the LLM's ArchitecturePlan + parsed data.

**This tool makes ZERO interpretive decisions.** It applies the plan.

```typescript
// Input
{
  plan: ArchitecturePlan;
  parseArtifactId: string;       // artifact store ID from mindmap.parse
  resolvedFiles: ResolvedFiles;  // from mindmap.resolve (small, stays in LLM context)
  policy: {
    edgeAggregation: boolean;    // default true
    maxDepth?: number;
    collapseRules?: CollapseRule[];
    includeSymbolNodes?: boolean; // default false for large repos
    symbolNodeThreshold?: number; // include symbol nodes for files with <= N symbols
  };
}

// Output (compact — full MindMapJSON stored in artifact store)
{
  artifactId: string;              // reference to stored MindMapJSON
  summary: {
    nodeCount: number;
    edgeCount: number;
    groupCount: number;
    maxDepth: number;
    languages: string[];
    topGroups: Array<{ label: string; fileCount: number }>;
    edgeBreakdown: Record<string, number>;  // rel type → count
  };
}
```

The build tool internally reads ParseResult from the store via `parseArtifactId`, constructs the full MindMapJSON, stores it in the artifact store, and returns only a compact summary to the LLM.

**Full MindMapJSON structure** (stored in artifact store, not sent to LLM):

```typescript
// MindMapJSON — stored server-side
{
  meta: {
    generatedAt: string;
    rootPath: string;
    view: string;
    nodeCount: number;
    edgeCount: number;
    toolVersions: { mcpServer: string; treeSitter: string };
  };
  nodes: Array<{
    id: string;
    label: string;
    kind: "root" | "group" | "file" | "symbol";
    type: string;                    // LLM-assigned: "service", "controller", "component", etc.
    parentId?: string;
    metadata: {
      canonicalPath?: string;
      fileId?: string;
      symbolId?: string;
      language?: string;
      role?: string;                 // from LLM's classification
      importance?: "core" | "supporting" | "peripheral";
    };
    style?: {
      icon?: string;
      color?: string;
    };
    evidence?: {
      startLine?: number;
      endLine?: number;
      reason: string;
    };
    confidence: number;              // from LLM's classification confidence
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    rels: Array<"imports" | "calls" | "extends" | "implements" |
                "routes_to" | "reads_config" | "emits_event" |
                "listens_event" | "injects" | "conceptual">;
    label?: string;
    metadata?: {
      importedSymbols?: string[];
      annotation?: string;           // LLM's explanation of this relationship
    };
    evidence?: {
      startLine?: number;
      endLine?: number;
      reason: string;
    };
    confidence: number;
  }>;
}
```

---

### Tool 7: `mindmap.validate`

**Purpose:** Validate graph structural integrity. Reads MindMapJSON from artifact store. Produces repair hints.

```typescript
// Input
{
  mindmapArtifactId: string;       // artifact store ID from mindmap.build
}

// Output: ValidationReport (returned fully — reports are compact ~1-2K tokens)
{
  artifactId: string;              // stored in artifact store for publish
  isValid: boolean;
  errors: Array<{
    type: "error";
    code: "ORPHAN_NODE" | "BROKEN_EDGE" | "DUPLICATE_ID" | "MISSING_ROOT" |
          "PARENT_CYCLE" | "SCHEMA_VIOLATION";
    message: string;
    location?: string;              // node/edge ID
  }>;
  warnings: Array<{
    type: "warning";
    code: "LARGE_GROUP" | "DEEP_NESTING" | "MANY_EDGES" | "LOW_CONFIDENCE" |
          "UNCONNECTED_SUBGRAPH";
    message: string;
    location?: string;
  }>;
  stats: {
    totalNodes: number;
    totalEdges: number;
    orphanNodes: number;
    brokenEdges: number;
    parentCycles: number;
    maxDepth: number;
    avgEdgesPerNode: number;
    connectedComponents: number;
  };
  repairHints: Array<{
    kind: "assign_parent" | "drop_edge" | "merge_nodes" | "add_root" | "break_cycle";
    targetId: string;
    details: Record<string, unknown>;
  }>;
}
```

Note: ValidationReport IS returned fully to the LLM (unlike MindMapJSON) because:
1. Reports are small (~1-2K tokens)
2. The LLM needs to **interpret** the errors/warnings to decide repair strategy
3. The report is also stored in the artifact store for `mindmap.publish` to include
```

---

### Tool 8: `mindmap.publish` *(MANDATORY FINAL)*

**Purpose:** The ONLY place where final output is emitted. Reads all artifacts from the store. The agent MUST call this.

```typescript
// Input (lightweight — just artifact IDs + options)
{
  mindmapArtifactId: string;         // from mindmap.build
  validationArtifactId: string;      // from mindmap.validate
  plan: ArchitecturePlan;            // the LLM's plan (already in context)
  options: {
    emitEvent: boolean;              // default true
    writeFiles?: {
      mindmapPath?: string;
      validationPath?: string;
      planPath?: string;
    };
    format: "pretty" | "compact";    // default "pretty"
  };
}

// Output (returned to LLM — compact confirmation)
{
  published: true;
  artifactId: string;                // unique ID for this generation
  paths?: {
    mindmapPath?: string;
    validationPath?: string;
    planPath?: string;
  };
  summary: {
    nodes: number;
    edges: number;
    groups: number;
    languages: string[];
    warnings: number;
    errors: number;
  };
  payloadSizeBytes: number;
}

// Also emits via MCP structuredContent (for frontend consumers):
{
  eventType: "mindmap/final";
  artifactId: string;
  data: {
    mindmap: MindMapJSON;            // full data read from artifact store
    validation: ValidationReport;     // full data read from artifact store
    plan: ArchitecturePlan;
  };
  meta: {
    generatedAt: string;
    rootPath: string;
    view: string;
    toolVersions: { ... };
  };
}
```

The publish tool:
1. Reads MindMapJSON from artifact store via `mindmapArtifactId`
2. Reads ValidationReport from artifact store via `validationArtifactId`
3. Receives ArchitecturePlan directly (it's in the LLM context from Phase 3)
4. Bundles everything into the final envelope
5. Emits via `structuredContent` for programmatic consumers
6. Optionally writes to disk
7. Clears the artifact store (session complete)

---

## 7. ArchitecturePlan Schema

The ArchitecturePlan is the LLM's primary output. It's a structured JSON that drives the build phase.

```typescript
interface ArchitecturePlan {
  version: "2";

  // High-level architecture description
  architecture: {
    pattern: string;           // "MVC", "Clean Architecture", "Feature-based", etc.
    description: string;       // 1-2 sentence summary
    primaryLanguage: string;
    frameworks: string[];      // detected frameworks
  };

  // View strategy
  view: "layer_then_domain" | "domain_then_layer" | "flat" | "custom";

  // Semantic groups
  groups: Array<{
    groupId: string;
    label: string;             // human-readable: "Authentication", "Data Layer"
    kind: "layer" | "domain" | "feature" | "infrastructure" | "external" | "other";
    description?: string;
    parentGroupId?: string;    // for nested groups
    matchRules: Array<{
      type: "glob" | "fileId" | "canonicalPathContains" | "languageIs";
      value: string;
    }>;
  }>;

  // File classifications
  classifications: Array<{
    fileId: string;
    canonicalPath: string;
    role: string;              // "service", "controller", "model", "util", etc.
    parentGroupId: string;
    importance: "core" | "supporting" | "peripheral";
    confidence: number;        // 0-1
    reasoning?: string;        // brief explanation
  }>;

  // LLM-discovered relationships (beyond import graph)
  additionalRelationships: Array<{
    sourceFileId: string;
    targetFileId: string;
    rels: string[];            // "emits_event", "injects", "conceptual", etc.
    annotation: string;        // explanation
    confidence: number;
  }>;

  // Edge policy
  edgePolicy: {
    aggregation: boolean;      // default true
    relPriority: string[];     // display priority order
    hideWeakEdges: boolean;    // hide edges below confidence threshold
    weakEdgeThreshold: number; // default 0.3
  };

  // Exclusions
  exclusions: {
    globs: string[];           // files to exclude from mind map
    reasons: string[];         // why excluded
  };

  // Collapse rules
  collapseRules: Array<{
    when: {
      groupKind?: string;
      fileCount?: { gt: number };
      importance?: string;
    };
    action: "collapse" | "summarize" | "hide";
    label?: string;
  }>;
}
```

---

## 8. Multi-Language Support via Tree-sitter

### Strategy

Use **Tree-sitter** as the universal parsing engine. Each language needs:
1. A Tree-sitter grammar (most are available as npm packages)
2. A set of **queries** that extract imports, exports, and symbols in a language-specific way
3. A **normalizer** that maps language-specific concepts to our unified output format

### Language Support Tiers

**Tier 1 (v1 — full support):**
- TypeScript / JavaScript / JSX / TSX
- Python
- Go
- Rust
- Java

**Tier 2 (v1.1 — planned):**
- C / C++
- C#
- Ruby
- PHP
- Kotlin
- Swift

**Tier 3 (future — community):**
- Any language with a Tree-sitter grammar can be added by writing queries + normalizer

### Tree-sitter Query Architecture

```
mcp-server/src/languages/
  index.ts                  # language registry
  types.ts                  # common output types
  typescript/
    queries.scm             # Tree-sitter queries for TS
    normalizer.ts           # map TS AST → unified format
  python/
    queries.scm
    normalizer.ts
  go/
    queries.scm
    normalizer.ts
  rust/
    queries.scm
    normalizer.ts
  java/
    queries.scm
    normalizer.ts
```

Each normalizer implements:
```typescript
interface LanguageNormalizer {
  language: string;
  extensions: string[];
  extractImports(tree: Tree, source: string): RawImport[];
  extractExports(tree: Tree, source: string): RawExport[];
  extractSymbols(tree: Tree, source: string): RawSymbol[];
}
```

---

## 9. Agent Behavior Specification

### State Machine (Artifact-Based Flow)

```
START
  │
  ▼
[DISCOVERY] ──scan──resolve──context──▶ [EXTRACTION]
  │                                      │
  │                              parse(summary) → artifactId:pr-1
  │                              parse(standard, selected) → appends to pr-1
  │                              parse(detailed, critical) → appends to pr-1
  │                                      │
  │                          LLM receives: summaries + parse details
  │                          Store holds: full ParseResult (pr-1)
  │                                      │
  │                                      ▼
  │                                [INTERPRETATION]
  │                                 LLM analyzes data in context
  │                                 LLM calls sample() if needed
  │                                 LLM produces ArchitecturePlan
  │                                      │
  │                          LLM holds: ArchitecturePlan in context
  │                                      │
  │                                      ▼
  │                                [CONSTRUCTION]
  │                                 build(plan, parseArtifactId:pr-1)
  │                                      │
  │                          LLM receives: { artifactId:mm-1, summary }
  │                          Store holds: full MindMapJSON (mm-1)
  │                                      │
  │                                      ▼
  │                                [VALIDATION]
  │                                 validate(mindmapArtifactId:mm-1)
  │                                      │
  │                          LLM receives: full report + artifactId:vr-1
  │                                   │        │
  │                                valid?    invalid?
  │                                   │     adjust plan
  │                                   │     rebuild → mm-2, vr-2 (max 2x)
  │                                   │        │
  │                                   ▼        │
  │                                [PUBLISH] ◀─┘
  │                                 publish(mm-1, vr-1, plan)
  │                                      │
  │                          Store: reads mm-1, vr-1, bundles all
  │                          Emits: structuredContent with full data
  │                          Clears: artifact store
  │                                      │
  │                                      ▼
                                       END
```

### Token Flow Summary

```
Phase         │ LLM Receives              │ Store Holds
──────────────┼───────────────────────────┼─────────────────────────
Discovery     │ file list, context (~3K)  │ —
Extraction    │ parse summaries (~5K)     │ ParseResult (full)
Interpretation│ — (uses context data)     │ ParseResult
Construction  │ summary (~200 tokens)     │ ParseResult + MindMapJSON
Validation    │ report (~1.5K tokens)     │ ParseResult + MindMap + Report
Publication   │ confirmation (~100 tokens)│ → all read, bundled, cleared
──────────────┼───────────────────────────┼─────────────────────────
Total LLM     │ ~10K tokens (data)        │
vs. without   │ ~37K tokens (data)        │ → ~73% savings
```

### LLM Interpretation Phase — Detailed

This is the most critical phase. The LLM MUST:

1. **Read project context** from `mindmap.context` output:
   - What language? What framework? What package manager?
   - What does the README say about the project?
   - What's the folder structure telling us?

2. **Analyze parse summaries** from `mindmap.parse(depth="summary")`:
   - Which folders have the most files?
   - Where are the entry points?
   - How are imports distributed?

3. **Form an architecture hypothesis**:
   - "This looks like a NestJS monorepo with 3 microservices"
   - "This is a Django project with apps for auth, api, and admin"

4. **Request detailed parsing** for architecturally significant files:
   - Entry points, core modules, heavily-imported files
   - Files the LLM isn't sure about

5. **Optionally sample code** via `mindmap.sample` for ambiguous cases:
   - "This file has 20 functions but no clear pattern — let me read it"
   - Limited to essential cases to save tokens

6. **Produce the ArchitecturePlan**:
   - Classify every file
   - Define semantic groups
   - Annotate hidden relationships
   - Set presentation strategy

### Hard Rules for the Agent

1. **NEVER** print MindMapJSON as final answer text.
2. **ALWAYS** call `mindmap.publish` as the final step.
3. **NEVER** skip the interpretation phase — the LLM must classify files, not the tools.
4. **At most 2 repair iterations** in the validation phase.
5. **Use hierarchical parsing** — don't request `depth="detailed"` for all files.
6. **Include reasoning** in ArchitecturePlan classifications (at least for low-confidence ones).
7. **Pass artifactIds, not data** — never re-send MindMapJSON or ParseResult to tools. Use artifact store IDs.
8. **Track artifactIds** — keep `parseArtifactId`, `mindmapArtifactId`, `validationArtifactId` through the session.
9. **On rebuild** — the artifact store replaces old entries; use the NEW artifactId from the new build/validate calls.

---

## 10. Repository Structure

> **Note:** Claude Code uses `.claude/` directory conventions. There is NO `plugin.json`.
> Hooks go in `.claude/settings.json` (not a separate file).
> See RESEARCH.md for full Claude Code extensibility documentation.

```
mindmap-claude-plugin/
  README.md

  # Claude Code integration files
  .claude/
    commands/
      mindmap.md                 # /mindmap slash command
    agents/
      mindmap-agent.md           # orchestrator agent (YAML frontmatter + markdown)
    skills/
      mindmap-rules.md           # rules for stable IDs, evidence, mandatory publish
    settings.json                # hooks config (PreToolUse, PostToolUse, SubagentStop)

  .mcp.json                      # MCP server registration (stdio transport)

  # MCP Server (TypeScript)
  mcp-server/
    package.json
    tsconfig.json
    src/
      index.ts                    # MCP server entry, tool registration
      tools/
        scan.ts
        resolve.ts
        context.ts
        parse.ts
        sample.ts
        build.ts
        validate.ts
        publish.ts
      languages/                  # Tree-sitter language support
        index.ts                  # language registry & detection
        types.ts                  # unified output types
        typescript/
          queries.scm
          normalizer.ts
        python/
          queries.scm
          normalizer.ts
        go/
          queries.scm
          normalizer.ts
        rust/
          queries.scm
          normalizer.ts
        java/
          queries.scm
          normalizer.ts
      schemas/
        raw-file-list.schema.json
        resolved-files.schema.json
        project-context.schema.json
        parse-result.schema.json
        architecture-plan.schema.json
        mindmap.schema.json
        validation-report.schema.json
        publish-input.schema.json
        publish-output.schema.json
      lib/
        hashing.ts
        canonicalize.ts
        evidence.ts
        globs.ts
        json.ts
        tree-sitter-loader.ts    # Tree-sitter grammar loader
        artifact-store.ts         # In-memory artifact store for server-side state
```

### Key File Details

**`.claude/agents/mindmap-agent.md`** — YAML frontmatter format:
```yaml
---
name: mindmap-agent
description: Generates architecture-aware mind maps for code repositories
tools:
  - mcp__mindmap__scan
  - mcp__mindmap__resolve
  - mcp__mindmap__context
  - mcp__mindmap__parse
  - mcp__mindmap__sample
  - mcp__mindmap__build
  - mcp__mindmap__validate
  - mcp__mindmap__publish
model: sonnet
---

[Agent instructions — phase machine, interpretation responsibilities, hard rules...]
```

**`.claude/settings.json`** — hooks configuration:
```json
{
  "hooks": {
    "SubagentStop": [
      {
        "matcher": "mindmap-agent",
        "command": "echo 'Mind map generation complete'"
      }
    ]
  }
}
```

**`.mcp.json`** — MCP server registration:
```json
{
  "mcpServers": {
    "mindmap": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "transport": "stdio"
    }
  }
}
```

**MCP tool naming in Claude Code:** Tools are called as `mcp__mindmap__scan`, `mcp__mindmap__build`, etc. (double underscore prefix).

---

## 11. Implementation Steps

### Step 1 — Project Bootstrap
- Create folder structure (including `.claude/` directory).
- Initialize `mcp-server` as TypeScript package (Node 18+).
- Add Tree-sitter and language grammar dependencies.
- Add `@modelcontextprotocol/sdk` and Zod for MCP server.
- Add build scripts: `build`, `dev`, `lint`, `test`.

### Step 2 — MCP Server Bootstrap + Artifact Store
- Implement `src/index.ts` with `McpServer` class + stdio transport.
- Register all 8 tools with Zod input schemas.
- Implement `lib/artifact-store.ts` — in-memory store with put/get/getSummary/clear.
- Add JSON schema validation middleware (fail fast on invalid input/output).
- **CRITICAL:** Never use `console.log()` in MCP server (corrupts JSON-RPC stdio). Use `console.error()` for debug logging.

### Step 3 — Implement Data Extraction Tools
- `scan.ts` — glob walk + configurable ignores + stats.
- `resolve.ts` — path canonicalization + content hashing + stable file IDs.
- `context.ts` — project metadata extraction (package files, README, folder structure, language stats).
- `sample.ts` — file snippet reader with line range support.

### Step 4 — Implement Tree-sitter Parse Infrastructure
- `tree-sitter-loader.ts` — load grammars dynamically by language.
- `languages/types.ts` — unified import/export/symbol types.
- `languages/index.ts` — language detection and registry.
- Start with TypeScript normalizer + queries.
- Add Python, Go, Rust, Java normalizers.
- `parse.ts` — orchestrate multi-language parsing with 3 depth levels.
  - Implement pagination (batchSize, cursor, appendToArtifact).
  - Store full ParseResult in artifact store; return data + artifactId.

### Step 5 — Implement Construction & Validation Tools
- `build.ts` — construct graph from ArchitecturePlan + ParseResult (read from store).
  - Node creation from groups + file classifications.
  - Edge creation from imports + additional relationships.
  - Edge aggregation logic.
  - Collapse rule application.
  - Store full MindMapJSON in artifact store.
  - Return only `artifactId` + compact summary to LLM.
- `validate.ts` — graph integrity checks (read MindMapJSON from store).
  - Orphan detection, broken edge detection, cycle detection.
  - Connected component analysis.
  - Repair hint generation.
  - Store ValidationReport in artifact store.
  - Return full report + artifactId (reports are small).

### Step 6 — Implement Publish Tool
- `publish.ts` — read all artifacts from store by IDs + bundle.
- Emit via `structuredContent` for programmatic consumers.
- Optionally write to disk.
- Clear artifact store after successful publish.

### Step 7 — Claude Code Integration Wiring
- `.mcp.json` — register MCP server (stdio transport, `node mcp-server/dist/index.js`).
- `.claude/commands/mindmap.md` — `/mindmap` slash command definition.
- `.claude/agents/mindmap-agent.md` — orchestrator agent instructions with YAML frontmatter (critical — must encode the phase machine, interpretation responsibilities, artifact ID tracking, and hard rules).
- `.claude/skills/mindmap-rules.md` — rules for stable IDs, evidence, aggregation, mandatory publish.
- `.claude/settings.json` — hooks configuration (SubagentStop notification).

### Step 8 — End-to-End Testing
- Test on a TypeScript project.
- Test on a Python project.
- Test on a multi-language project.
- Verify: every run ends with `mindmap.publish`.
- Verify: stable IDs across identical runs.
- Verify: artifact store is properly cleared after publish.
- Verify: token usage is within expected bounds (log artifact sizes).

### Step 9 — Polish
- README with install/usage.
- Error messages for unsupported languages (graceful degradation).
- Token budget estimation logging (compare with/without artifact store).

---

## 12. Quality Bar

- **Deterministic tools** — same input always produces same output, no LLM inside tools.
- **Stable IDs** — unchanged files produce unchanged IDs across runs.
- **Evidence** — every node and edge traces back to source code line ranges.
- **Multi-language** — at minimum TypeScript + Python + Go in v1.
- **Edge aggregation** — on by default, reducing visual noise.
- **Validation catches real issues** — orphans, broken refs, cycles.
- **LLM does the thinking** — architecture recognition, classification, grouping are LLM responsibilities.
- **Agent always publishes** — final output via `mindmap.publish`, never as chat text.
- **Hierarchical parsing** — agent uses summary → standard → detailed progression for token efficiency.
- **Artifact store** — large data objects stored server-side, LLM only sees summaries + artifactIds (~75-87% token savings).
- **Pagination** — parse tool supports cursor-based pagination for repos with 200+ files.

---

## 13. Token Efficiency Analysis

### Estimated Token Usage (56-file TypeScript project)

| Phase | Without Artifact Store | With Artifact Store | Savings |
|-------|----------------------|--------------------:|--------:|
| Discovery (scan+resolve+context) | ~3K | ~3K | 0% |
| Extraction (parse summary+standard) | ~8K | ~8K | 0% |
| Interpretation (LLM reasoning) | ~2K | ~2K | 0% |
| Construction (build input/output) | ~15K | ~0.5K | 97% |
| Validation (validate input/output) | ~14K | ~2K | 86% |
| Publication (publish input/output) | ~22K | ~0.5K | 98% |
| **Total data tokens** | **~64K** | **~16K** | **75%** |

### Estimated Token Usage (500-file large repo)

| Phase | Without Artifact Store | With Artifact Store | Savings |
|-------|----------------------|--------------------:|--------:|
| Discovery | ~8K | ~8K | 0% |
| Extraction (paginated) | ~25K | ~25K | 0% |
| Interpretation | ~4K | ~4K | 0% |
| Construction | ~80K | ~0.5K | 99% |
| Validation | ~75K | ~2K | 97% |
| Publication | ~120K | ~0.5K | 99% |
| **Total data tokens** | **~312K** | **~40K** | **87%** |

The key insight: **Discovery, Extraction, and Interpretation data must reach the LLM** (it needs to interpret them). **Construction, Validation, and Publication data only needs to pass through** — the artifact store eliminates this repetition entirely.

---

## 14. Key Differences from Plan v1

| Aspect | Plan v1 | Plan v2 (This) |
|--------|---------|-----------------|
| Language support | TypeScript/JS only | Multi-language via Tree-sitter |
| File classification | Heuristic scores in `parse` tool | LLM interprets raw data directly |
| Architecture recognition | Implicit in agent prompt | Explicit in ArchitecturePlan schema |
| Parse depth | Single depth | 3 levels (summary/standard/detailed) |
| Project context | Not extracted | Dedicated `mindmap.context` tool |
| Code sampling | Not available | `mindmap.sample` tool for LLM |
| LLM role | Orchestration + low-confidence override | Primary intelligence for all interpretation |
| Tool role | Data extraction + heuristic classification | **Only** data extraction + mechanical operations |
| Relationship discovery | Import graph only | Import graph + LLM-annotated relationships |
| Token efficiency | Parse everything at full depth | Hierarchical parsing + server-side artifact store |
| Data transfer | Full data in every tool call | ArtifactId references — ~75-87% token savings |
| Pagination | None | Cursor-based for parse on large repos |
| Plugin format | `.claude-plugin/plugin.json` (wrong) | `.claude/` directory conventions (correct) |
| Hooks | Separate `hooks.json` file | `.claude/settings.json` under `hooks` key |
| MCP output | Plain content | `structuredContent` for programmatic consumers |
