import { type ArtifactStore } from "../lib/artifact-store.js";
import { type ToolResult, jsonResult } from "../types.js";

interface ParseFileInput {
  fileId: string;
  absolutePath: string;
  canonicalPath: string;
  language: string;
}

interface ParseArgs {
  rootPath: string;
  files: ParseFileInput[];
  depth: "summary" | "standard" | "detailed";
  options?: {
    maxSymbolsPerFile?: number;
    includeEvidence?: boolean;
    batchSize?: number;
    cursor?: string;
    appendToArtifact?: string;
  };
}

export async function handleParse(
  args: ParseArgs,
  _store: ArtifactStore,
): Promise<ToolResult> {
  // TODO: Implement Tree-sitter parsing with 3 depth levels + pagination
  return jsonResult({
    status: "not_implemented",
    tool: "mindmap.parse",
    receivedArgs: {
      rootPath: args.rootPath,
      fileCount: args.files.length,
      depth: args.depth,
    },
  });
}
