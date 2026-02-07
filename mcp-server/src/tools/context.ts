import { type ToolResult, jsonResult } from "../types.js";

interface ContextArgs {
  rootPath: string;
}

export async function handleContext(args: ContextArgs): Promise<ToolResult> {
  // TODO: Implement project metadata extraction (README, package files, folder structure)
  return jsonResult({
    status: "not_implemented",
    tool: "mindmap.context",
    receivedArgs: { rootPath: args.rootPath },
  });
}
