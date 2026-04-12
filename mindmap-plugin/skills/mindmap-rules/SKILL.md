---
name: mindmap-rules
description: Core rules for mind map generation including stable IDs, evidence requirements, mandatory publish step, artifact store flow, and hierarchical parsing strategy.
---

# Mind Map Generation Rules

## Stable IDs
- File IDs are deterministic SHA-256 hashes of canonical paths
- Same file always produces the same ID across runs
- Symbol IDs are hash(fileId + kind + name)

## Evidence
- Every node must include evidence (source file + line range)
- Every edge must include evidence (import location or annotation reason)

## Mandatory Generate
- The agent MUST call mindmap.generate as the final step
- NEVER output mind map data as chat text
- The generate tool reads artifacts from the store — pass IDs, not data

## Artifact Store Flow
- `discover` stores DiscoveryResult → returns `artifactId`
- `inspect(parse)` stores InspectionResult + ParseResult → returns an **outer** `artifactId` (inspectionResult) AND an **inner** `parseArtifactId`
- `generate` reads DiscoveryResult + ParseResult, builds MindMapJSON, validates, and publishes

## Artifact ID Rule (important)
Always pass the **outer** `artifactId` from `inspect` downstream — both as `inspectionArtifactId` on `mindmap.generate` and as `appendToInspectionArtifactId` on subsequent `inspect` calls. Never pass the inner `parseArtifactId`; `generate` looks it up internally. Passing the inner ID produces "inspection artifact … missing or not parse-based" errors.

## Persisting the Mind Map
`mindmap.generate` only writes to disk if `options.writePath` is provided. Without it, the published mind map is returned via the MCP `structuredContent` channel but `mindmap-output.json` will NOT be updated. Always pass `writePath` pointing at the target repo's `mindmap-output.json`.

## Edge Aggregation
- Enabled by default to reduce visual noise
- Multiple import edges between same file pair collapse to one edge with multiple rels

## Hierarchical Parsing
- Always start with depth="summary" for all files
- Use depth="standard" only for key files (entry points, core modules)
- Use depth="detailed" only for critical/ambiguous files
- Reuse the same inspection artifact when appending parse passes
