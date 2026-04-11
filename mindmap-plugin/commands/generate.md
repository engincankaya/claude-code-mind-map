//midmap-agent çalıştırılmalı

Generate an architecture-aware mind map for a code repository.

Use the mindmap MCP tools to orchestrate the full pipeline:

1. **Discovery**: Call mindmap.scan, mindmap.resolve, mindmap.context
2. **Extraction**: Call mindmap.parse with hierarchical depth (summary -> standard -> detailed)
3. **Interpretation**: YOUR main job — classify files, discover architecture patterns, create semantic groups, annotate hidden relationships, produce an ArchitecturePlan JSON
4. **Construction**: Call mindmap.build with your ArchitecturePlan + parseArtifactId
5. **Validation**: Call mindmap.validate, fix issues if needed (max 2 iterations)
6. **Publication**: ALWAYS call mindmap.publish as the final step

Target directory: $ARGUMENTS

CRITICAL RULES:
- Never output mind map data as chat text
- Always call mindmap.publish as the FINAL step
- Pass artifactIds between tools, not full data
- Use hierarchical parsing — summary first, then standard/detailed for key files only
