import { type ArtifactStore } from "../lib/artifact-store.js";
import { type ToolResult, jsonResult } from "../types.js";

interface BuildArgs {
  plan: Record<string, unknown>;
  parseArtifactId: string;
  resolvedFiles: Record<string, unknown>;
  policy?: {
    edgeAggregation?: boolean;
    maxDepth?: number;
    collapseRules?: Record<string, unknown>[];
    includeSymbolNodes?: boolean;
    symbolNodeThreshold?: number;
  };
}

export async function handleBuild(
  args: BuildArgs,
  _store: ArtifactStore,
): Promise<ToolResult> {
  // TODO: Implement graph construction from ArchitecturePlan + ParseResult
  return jsonResult({
    status: "not_implemented",
    tool: "mindmap.build",
    receivedArgs: {
      parseArtifactId: args.parseArtifactId,
      hasPlan: !!args.plan,
    },
  });
}
