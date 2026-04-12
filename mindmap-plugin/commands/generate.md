Delegate to the `mindmap-agent` subagent and run the full pipeline end-to-end.

Generate an architecture-aware mind map for a code repository.

Use the mindmap MCP tools to orchestrate the full pipeline:

1. **Discovery**: Call `mindmap.discover`
2. **Extraction**: Call `mindmap.inspect` with hierarchical depth (`summary` -> `standard` -> `detailed`), appending to the same inspection artifact across parse calls
3. **Interpretation**: YOUR main job — classify files, discover architecture patterns, create semantic groups, write strong group descriptions, highlight 2-3 key files per group. Write a **one-line role description for every file** (what it does), and an additional 2-3 sentence detailed description for the highlighted files only.
4. **Generation**: Call `mindmap.generate` with your ArchitecturePlan + discoveryArtifactId + inspectionArtifactId

Target directory: $ARGUMENTS

CRITICAL RULES:
- Never output mind map data as chat text
- Always call `mindmap.generate` as the FINAL step
- Pass artifactIds between tools, not full data. `mindmap.inspect` returns an outer `artifactId` and an inner `parseArtifactId` — always pass the **outer** `artifactId` downstream (to `appendToInspectionArtifactId` and to `mindmap.generate`'s `inspectionArtifactId`).
- Use hierarchical parsing — summary first, then standard/detailed for key files only
- Pass `options.writePath` pointing at `mindmap-output.json` in the target directory so the result is written to disk, not only to the MCP structured channel
