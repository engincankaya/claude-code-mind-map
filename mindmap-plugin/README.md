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

1. **Discovery** — Scans and resolves all source files
2. **Extraction** — Parses code with Tree-sitter (TypeScript, Python, Go, Rust, Java)
3. **Interpretation** — LLM classifies files, discovers patterns, creates semantic groups
4. **Construction** — Builds a graph from the architecture plan
5. **Validation** — Checks graph integrity
6. **Publication** — Writes `mindmap-output.json` to the project root

## Supported Languages

TypeScript/JavaScript, Python, Go, Rust, Java

## First Use

On first use, Claude Code will ask you to approve the MCP tools (`mindmap.scan`, `mindmap.resolve`, etc.). Accept to enable the plugin's functionality.

## License

MIT
