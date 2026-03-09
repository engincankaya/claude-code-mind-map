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

## Mandatory Publish
- The agent MUST call mindmap.publish as the final step
- NEVER output mind map data as chat text
- The publish tool reads artifacts from the store — pass IDs, not data

## Artifact Store Flow
- parse stores ParseResult → returns artifactId
- build reads ParseResult, stores MindMapJSON → returns artifactId
- validate reads MindMapJSON, stores ValidationReport → returns artifactId
- publish reads all artifacts by ID, bundles, clears store

## Edge Aggregation
- Enabled by default to reduce visual noise
- Multiple import edges between same file pair collapse to one edge with multiple rels

## Hierarchical Parsing
- Always start with depth="summary" for all files
- Use depth="standard" only for key files (entry points, core modules)
- Use depth="detailed" only for critical/ambiguous files
