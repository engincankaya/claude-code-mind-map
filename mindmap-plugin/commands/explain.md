Explain the architectural role and dependencies of a file or component in this project.

Read `mindmap-output.json` and find the node(s) matching: $ARGUMENTS

For each matched node, explain:
1. **Role**: What this file does (prefer node `metadata.description`, otherwise use node `type`)
2. **Group**: Which architectural layer/domain it belongs to
3. **Importance**: core / supporting / peripheral
4. **Dependencies** (outgoing edges): What this file uses — skip if the mind map has no edges
5. **Dependents** (incoming edges): What uses this file — skip if the mind map has no edges
6. **Cross-group connections**: Any edges that cross group boundaries — skip if the mind map has no edges

If the mind map's `edges` array is empty, note that edge-based analysis is unavailable and suggest regenerating with `detailed` depth.

Keep the explanation concise (under 15 lines). Use the file's architectural role, not just its name.

If no mind map exists, tell the user to run `/mindmap:generate` first.
