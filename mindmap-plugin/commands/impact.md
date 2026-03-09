Analyze the impact of changing a file or component in this project.

Read `mindmap-output.json` and find the node(s) matching: $ARGUMENTS

Trace the dependency graph to show:
1. **Direct dependents** (1-hop): files that import from the target
2. **Indirect dependents** (2-hop): files that depend on the direct dependents
3. **Risk level**: HIGH if core-importance files are affected, MEDIUM if supporting, LOW if peripheral only
4. **Cross-group impact**: flag any dependencies that cross architectural boundaries

Output a clear impact summary with risk assessment and suggested review/test actions.

If no mind map exists, tell the user to run `/mindmap:generate` first.
