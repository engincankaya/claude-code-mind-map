# Mindmap Plugin for Claude Code

Architecture-aware mind map generator for code repositories. Uses Tree-sitter parsing and LLM interpretation to create interactive knowledge graphs of any codebase.

## Requirements

- Node.js >= 20
- Claude Code >= 1.0.33

## Installation

```bash
claude plugin install github:engincankaya/mind-map
```

## Commands

| Command | Description |
|---------|-------------|
| `/mindmap:generate <path>` | Generate a mind map for the given directory |
| `/mindmap:explain <file>` | Explain a file's architectural role and dependencies |
| `/mindmap:impact <file>` | Analyze the impact of changing a file |

## Agents

| Agent | Description |
|-------|-------------|
| `mindmap:mindmap-agent` | Orchestrates full mind map generation pipeline |
| `mindmap:architect-agent` | Architecture-aware coding assistant using the knowledge graph |
| `mindmap:impact-agent` | Analyzes ripple effect of code changes |
| `mindmap:onboard-agent` | Interactive onboarding guide for new developers |

## How It Works

1. **Discovery** — `mindmap.discover` scans, resolves, and extracts repository context
2. **Extraction** — `mindmap.inspect` parses code or samples snippets as needed
3. **Interpretation** — LLM classifies files, discovers patterns, creates semantic groups, writes rich group descriptions, and highlights a few representative files per group
4. **Generation** — `mindmap.generate` builds, validates, and writes `mindmap-output.json`

## MCP Tools

- `mindmap.discover` — scan + resolve + context in one call
- `mindmap.inspect` — parse (summary/standard/detailed) or sample code snippets
- `mindmap.generate` — build + validate + publish the final mind map
- `mindmap.overview` — read an existing `mindmap-output.json` and return an LLM-friendly project summary

## Supported Languages

TypeScript/JavaScript, Python, Go, Rust, Java

## First Use

On first use, Claude Code will ask you to approve the MCP tools (`mindmap.discover`, `mindmap.inspect`, etc.). Accept to enable the plugin's functionality.

## License

MIT
