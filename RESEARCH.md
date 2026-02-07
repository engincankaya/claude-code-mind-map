# Claude Code Extensibility Research — Complete Technical Reference

> Compiled from official Anthropic docs, MCP specification, and Claude Code source/documentation.

---

## KEY FINDING: There Is No "Plugin System"

Claude Code does **NOT** have a formal plugin manifest like VS Code's `package.json` or a `plugin.json` schema. What it has is a set of **distributed extensibility mechanisms** that, when combined, create a plugin-like experience:

| Mechanism | File Location | Purpose |
|---|---|---|
| **Skills** | `SKILL.md` / `.claude/skills/*.md` | Passive knowledge injection |
| **Commands** | `.claude/commands/*.md` | User-invokable `/slash` commands |
| **Agents** | `.claude/agents/*.md` | Independent sub-agents with own context |
| **Hooks** | `.claude/settings.json` → `hooks` | Lifecycle event scripts |
| **MCP Servers** | `.mcp.json` (project root) | Custom tools via Model Context Protocol |
| **Settings** | `.claude/settings.json` | Permissions, env vars, model selection |
| **CLAUDE.md** | Project root / subdirs | Persistent project instructions |

All discovery is **convention-based** — place files in the right directory and Claude Code finds them automatically.

---

## 1. COMMANDS (Slash Commands)

### What They Are
Markdown files whose content becomes the prompt when the user types `/command-name`.

### Location
```
.claude/commands/mindmap.md        → /mindmap
.claude/commands/frontend/review.md → /frontend:review
~/.claude/commands/my-cmd.md       → /my-cmd (user-global)
```

### Format
```markdown
Analyze the current repository and generate a mind map.

Use the mindmap MCP tools to scan, resolve, parse, and build the graph.

Target directory: $ARGUMENTS

Always call mindmap.publish as the final step.
```

### Key Details
- Filename (minus `.md`) = command name
- `$ARGUMENTS` placeholder gets replaced with user input after the command
- Subdirectories create namespaced commands with `:` separator
- Project commands take precedence over user-level ones
- Commands are just prompts — no code execution

---

## 2. SKILLS

### What They Are
Markdown instruction files automatically loaded into Claude's context when relevant. They provide **passive knowledge** (Claude reads them for guidance).

### Location & Discovery
```
SKILL.md                            # Root project skill
.claude/skills/SKILL.md             # General project skill
.claude/skills/react-patterns.md    # Named skill
src/components/SKILL.md             # Directory-specific skill
~/.claude/skills/my-style.md        # User-global skill
```

### Format
Pure freeform Markdown. No frontmatter required.

```markdown
# Mind Map Generation Rules

## Stable IDs
- File IDs must be deterministic hashes of canonical paths
- Same file must always produce the same ID across runs

## Evidence
- Every node must include evidence (source file, line range)

## Mandatory Publish
- The agent MUST call mindmap.publish as the final step
- Never output mind map data as chat text
```

### How They Work
- Loaded **automatically** into system prompt when deemed relevant
- Skills closer to current working context have higher relevance
- No registration needed — mere file presence is sufficient
- Skills are **passive** (read by Claude), not **active** (executed)

---

## 3. AGENTS (Sub-Agents)

### What They Are
Independent Claude instances with their own context window and tool access. Defined as Markdown files with YAML frontmatter.

### Location
```
.claude/agents/mindmap-agent.md
.claude/agents/code-reviewer.md
```

### Format
```markdown
---
name: mindmap-agent
description: Generates architecture-aware mind maps for code repositories
tools:
  - Read
  - Glob
  - Grep
  - Bash
  - mcp__mindmap__scan
  - mcp__mindmap__resolve
  - mcp__mindmap__context
  - mcp__mindmap__parse
  - mcp__mindmap__sample
  - mcp__mindmap__build
  - mcp__mindmap__validate
  - mcp__mindmap__publish
model: claude-sonnet-4-20250514
---

You are a specialized agent for generating architecture-aware mind maps.

## Your Role
You orchestrate phases, interpret data, make architectural judgments.

## Phase 1: Discovery
Call mindmap.scan, mindmap.resolve, and mindmap.context.

## Phase 2: Extraction
Call mindmap.parse with depth="summary" first...

(etc.)
```

### Frontmatter Schema
```yaml
---
name: string           # Agent identifier
description: string    # What the agent does (shown to Claude for delegation)
tools:                 # Allowed tools (built-in + MCP tools)
  - Read
  - Write
  - mcp__servername__toolname
model: string          # Optional model override
---
```

### How They Work
- Invoked via the **Task tool** or through commands
- Get their own independent context window
- Have access to specified tools (built-in + MCP)
- Return results to the parent agent
- `SubagentStop` hook fires when they complete

### Agent vs Skill

| Aspect | Skill | Agent |
|---|---|---|
| Execution | Passive (context injection) | Active (runs independently) |
| Context | Shared with main conversation | Own separate context window |
| Tools | N/A (just instructions) | Has its own tool access list |
| Invocation | Automatic (relevance-based) | Explicit (Task tool / command) |

---

## 4. HOOKS

### What They Are
Shell commands that run at specific lifecycle events. Deterministic and guaranteed (unlike tool use which is probabilistic).

### Configuration
In `.claude/settings.json` (project) or `~/.claude/settings.json` (user):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'About to write' >&2"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write \"$CLAUDE_FILE_PATH\" 2>/dev/null || true"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npm run lint:fix"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Sub-agent finished'"
          }
        ]
      }
    ]
  }
}
```

### Hook Events

| Event | When | Use Case |
|---|---|---|
| `PreToolUse` | Before tool execution | Block/validate tool calls |
| `PostToolUse` | After tool execution | Post-process, format |
| `Stop` | When Claude finishes a turn | Run linters, checks |
| `Notification` | On notification | Custom notification routing |
| `SubagentStop` | When sub-agent completes | Post-process sub-agent results |

### Hook Behavior
- **PreToolUse**: Non-zero exit = tool call **blocked**
- **PostToolUse**: Output appended to tool result
- **Stop**: Output fed back as new user message (Claude can continue)
- Hooks run **synchronously**, blocking Claude's execution

### Environment Variables in Hooks

| Variable | Available In | Description |
|---|---|---|
| `CLAUDE_FILE_PATH` | Pre/PostToolUse (Write/Edit) | File path |
| `CLAUDE_TOOL_NAME` | Pre/PostToolUse | Tool name |
| `CLAUDE_TOOL_INPUT` | Pre/PostToolUse | JSON tool input |
| `CLAUDE_TOOL_RESULT` | PostToolUse | Tool output |

---

## 5. MCP SERVER INTEGRATION

### `.mcp.json` Format

Project root file, designed to be committed to version control:

```json
{
  "mcpServers": {
    "mindmap": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    },
    "remote-api": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}
```

### Server Config Fields

| Field | Type | Description |
|---|---|---|
| `command` | string | Executable (stdio servers) |
| `args` | string[] | Command-line arguments |
| `env` | object | Environment variables |
| `cwd` | string | Working directory |
| `type` | string | `"http"` or `"sse"` for remote |
| `url` | string | URL for remote servers |
| `headers` | object | HTTP headers for remote |

### Scopes

| Scope | Location | Shared? |
|---|---|---|
| Local | `~/.claude.json` (project-specific) | No |
| Project | `.mcp.json` in project root | Yes (VCS) |
| User | `~/.claude.json` (global) | No |

### Environment Variable Expansion
```json
{
  "mcpServers": {
    "api": {
      "type": "http",
      "url": "${API_BASE_URL:-https://default.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

Supported syntax: `${VAR}` and `${VAR:-default}`

### Tool Naming in Claude Code
MCP tools appear as: `mcp__<server-name>__<tool-name>`

Example: Server named "mindmap" with tool "scan" → `mcp__mindmap__scan`

### Adding via CLI
```bash
claude mcp add mindmap --scope project -- node ./mcp-server/dist/index.js
claude mcp list
claude mcp remove mindmap
```

---

## 6. BUILDING AN MCP SERVER (TypeScript)

### Dependencies
```bash
npm install @modelcontextprotocol/sdk zod@3
npm install -D @types/node typescript
```

### package.json
```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### Server Implementation (src/index.ts)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mindmap-server",
  version: "1.0.0",
});

// Register a tool
server.registerTool(
  "mindmap.scan",
  {
    description: "Scan a repository and list all source files",
    inputSchema: {
      rootPath: z.string().describe("Root directory to scan"),
      ignore: z.array(z.string()).optional().describe("Glob patterns to ignore"),
      maxFiles: z.number().optional().describe("Maximum files to return"),
    },
  },
  async ({ rootPath, ignore, maxFiles }) => {
    // Implementation...
    const result = { rootPath, files: [], stats: { total: 0, included: 0, ignored: 0 } };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MindMap MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### CRITICAL: stdio Rules
- **NEVER** use `console.log()` — it corrupts JSON-RPC on stdout
- **ALWAYS** use `console.error()` for logging (goes to stderr)
- Server reads JSON-RPC from stdin, writes responses to stdout

### Tool Registration API

```typescript
server.registerTool(
  name: string,           // Tool identifier
  config: {
    description: string,  // Shown to LLM
    inputSchema: {        // Zod schemas per parameter
      param: z.string().describe("..."),
    },
    outputSchema?: {      // Optional structured output validation
      // Zod schemas
    },
  },
  handler: async (args) => {
    return {
      content: [
        { type: "text", text: "result string" }
      ],
      // Optional structured content:
      structuredContent: { key: "value" },
      // Error flag:
      isError: false,
    };
  }
);
```

### Tool Result Content Types

```typescript
// Text
{ type: "text", text: "result" }

// Image
{ type: "image", data: "base64...", mimeType: "image/png" }

// Resource
{ type: "resource", resource: { uri: "file:///path", text: "content" } }

// Resource link
{ type: "resource_link", uri: "file:///path", name: "file.ts", mimeType: "text/plain" }
```

### Structured Output (outputSchema)
When a tool defines `outputSchema`, the MCP protocol returns both:
- `content` array (for the LLM to read)
- `structuredContent` object (machine-parseable, schema-validated)

This is KEY for our `mindmap.publish` tool — it can return structured JSON that a frontend can consume directly.

---

## 7. STRUCTURED OUTPUT FROM AGENTS

### The Challenge
Claude Code agents produce free-form text. For structured JSON output, we have two strategies:

### Strategy 1: MCP Tool as Output Channel (RECOMMENDED)
The agent calls an MCP tool (`mindmap.publish`) that:
1. Receives structured data as input
2. Validates against a JSON schema
3. Returns it as both `content` and `structuredContent`
4. Optionally writes to files

This is our planned approach and it works perfectly with Claude Code's architecture.

### Strategy 2: Claude Code SDK with --json flag
For programmatic use:
```bash
claude -p "Generate the mindmap" --json
```
Returns the entire conversation as JSON, but the agent's text output is still free-form.

### Strategy 3: Prompt Engineering in Agent Instructions
The agent's `.md` file instructs it to always call the publish tool for final output, never printing raw JSON. This is enforced via the agent's instructions and skill rules.

### Our Approach (Combining All Three)
1. Agent `.md` file has hard rules: "ALWAYS call mindmap.publish"
2. Skill `SKILL.md` reinforces: "Never output mind map as text"
3. `mindmap.publish` tool validates and returns `structuredContent`
4. Hook (`SubagentStop`) can verify publish was called

---

## 8. COMPLETE DIRECTORY STRUCTURE FOR OUR PLUGIN

Based on research findings, the correct structure is:

```
mindmap-claude-plugin/
  .claude/
    commands/
      mindmap.md                    # /mindmap slash command
    agents/
      mindmap-agent.md              # Sub-agent definition
    skills/
      mindmap-rules.md              # Skill for generation rules  (or SKILL.md)
    settings.json                   # Hooks configuration
    settings.local.json             # Local overrides (gitignored)

  .mcp.json                         # MCP server registration (project root)

  CLAUDE.md                         # Project-level instructions

  mcp-server/                       # MCP tool server
    package.json
    tsconfig.json
    src/
      index.ts                      # Server entry + tool registration
      tools/
        scan.ts
        resolve.ts
        context.ts
        parse.ts
        sample.ts
        build.ts
        validate.ts
        publish.ts
      languages/                    # Tree-sitter support
        index.ts
        types.ts
        typescript/
        python/
        go/
        rust/
        java/
      schemas/                      # JSON schemas
        ...
      lib/                          # Shared utilities
        ...
```

### .mcp.json (project root)
```json
{
  "mcpServers": {
    "mindmap": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

### .claude/commands/mindmap.md
```markdown
Generate an architecture-aware mind map for this repository.

Use the MindMap Agent to orchestrate the full pipeline:
1. Discover files (scan + resolve + context)
2. Extract structure (parse with hierarchical depth)
3. Interpret architecture (YOUR main job — classify, group, name)
4. Build the graph
5. Validate and fix
6. Publish via mindmap.publish

$ARGUMENTS
```

### .claude/agents/mindmap-agent.md
```markdown
---
name: mindmap-agent
description: Generates architecture-aware mind maps by orchestrating MCP tools and interpreting codebase structure
tools:
  - Read
  - Glob
  - Grep
  - mcp__mindmap__scan
  - mcp__mindmap__resolve
  - mcp__mindmap__context
  - mcp__mindmap__parse
  - mcp__mindmap__sample
  - mcp__mindmap__build
  - mcp__mindmap__validate
  - mcp__mindmap__publish
---

(Agent instructions here — phase machine, interpretation rules, etc.)
```

### .claude/settings.json
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$CLAUDE_FILE_PATH\" | grep -q '\\.env'; then echo 'Cannot read .env files' >&2; exit 1; fi"
          }
        ]
      }
    ]
  }
}
```

---

## 9. IMPORTANT IMPLICATIONS FOR PLAN_V2

### What Needs to Change

1. **No `.claude-plugin/plugin.json`** — This file doesn't exist in Claude Code. Remove it from the plan. Use the native directory structure instead.

2. **Directory structure** — Use `.claude/` prefix:
   - `.claude/commands/` not `commands/`
   - `.claude/agents/` not `agents/`
   - `.claude/skills/` not `skills/`

3. **Agent frontmatter** — Agents need YAML frontmatter with `name`, `description`, `tools`, and optional `model`.

4. **MCP tool naming** — In agent tool lists, MCP tools are referenced as `mcp__mindmap__scan`, not `mindmap.scan`. The dot notation is for the MCP server internally; Claude Code uses double-underscore prefix.

5. **Hooks go in settings.json** — Not a separate `hooks.json` file.

6. **Structured output via `structuredContent`** — The `mindmap.publish` tool should use MCP's `structuredContent` field alongside the regular `content` array.

7. **`SubagentStop` hook** — Can be used to verify the publish tool was called and post-process the result.

---

## 10. MCP TOOL SEARCH

When many MCP tools are registered, Claude Code automatically enables **Tool Search** (when tool definitions exceed 10% of context window):

- Tools are deferred, not loaded upfront
- Claude uses a search mechanism to find relevant tools on-demand
- Configurable via `ENABLE_TOOL_SEARCH` env var: `auto` (default), `true`, `false`, `auto:<N>%`

For our 8 tools, this likely won't trigger. But good to know for future expansion.

---

## 11. MCP PROMPTS AS COMMANDS

MCP servers can expose **prompts** that become available as `/` commands:

```
/mcp__mindmap__generate
```

This is an alternative to `.claude/commands/mindmap.md` — the MCP server itself can define the prompt. Consider using this for a more self-contained plugin.
