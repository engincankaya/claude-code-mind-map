Analyze the impact of changing a file or component in this project.

**Requires a mind map with edges.** If `mindmap-output.json` has an empty `edges` array (which happens when `/mindmap:generate` only parsed at `summary` depth), tell the user to regenerate with `detailed` depth across source files before running impact analysis.

Read `mindmap-output.json` and find the node(s) matching: $ARGUMENTS

Trace the dependency graph to show:
1. **Direct dependents** (1-hop): files that import from the target
2. **Indirect dependents** (2-hop): files that depend on the direct dependents
3. **Risk level**: HIGH if core-importance files are affected, MEDIUM if supporting, LOW if peripheral only
4. **Cross-group impact**: flag any dependencies that cross architectural boundaries

Output a clear impact summary with risk assessment and suggested review/test actions.

If no mind map exists, tell the user to run `/mindmap:generate` first.
