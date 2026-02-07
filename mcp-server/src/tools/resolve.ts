import { type ToolResult, jsonResult } from "../types.js";

interface ResolveArgs {
  rootPath: string;
  files: string[];
}

export async function handleResolve(args: ResolveArgs): Promise<ToolResult> {
  // TODO: Implement path canonicalization + content hashing + stable IDs
  return jsonResult({
    status: "not_implemented",
    tool: "mindmap.resolve",
    receivedArgs: { rootPath: args.rootPath, fileCount: args.files.length },
  });
}
