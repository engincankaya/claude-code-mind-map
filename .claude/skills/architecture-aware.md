# Architecture-Aware Context

When a `mindmap-output.json` file exists in the project root, you have access to the project's architectural knowledge graph. Use this to give better, more contextual answers.

## Quick Reference Protocol

Before answering questions about code structure, file relationships, or where to make changes:

1. Read `mindmap-output.json` from the project root
2. Use the `meta` section for project overview (node count, edge count, generation time)
3. Use `nodes` to understand file roles — each file node has a `type` field describing its architectural role
4. Use `edges` to understand dependencies — trace `source` → `target` to follow import chains
5. Use node `metadata.importance` (core/supporting/peripheral) to gauge change risk

## Architecture Vocabulary

When discussing this codebase, use these terms based on the mind map groups:
- Refer to groups by their `label` (e.g., "the Tool Handlers layer", "the Infrastructure group")
- Refer to files by their role, not just their name (e.g., "the parse tool handler" not just "parse.ts")
- Describe cross-group dependencies as "architectural boundary crossings"

## Staleness Check

If `meta.generatedAt` is older than the latest git commit, the mind map may be stale. Mention this when it's relevant and suggest running `/mindmap` to refresh.

## When to Spawn Specialized Agents

- For deep architectural questions → use `architect-agent`
- For new developer onboarding → use `onboard-agent`
- For change impact analysis → use `impact-agent`
- To regenerate the mind map → use `/mindmap` command
