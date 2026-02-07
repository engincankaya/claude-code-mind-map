import { type ToolResult, jsonResult } from "../types.js";

interface ScanArgs {
  rootPath: string;
  ignore?: string[];
  maxFiles?: number;
}

export async function handleScan(args: ScanArgs): Promise<ToolResult> {
  // TODO: Implement file scanning with fast-glob
  return jsonResult({
    status: "not_implemented",
    tool: "mindmap.scan",
    receivedArgs: { rootPath: args.rootPath },
  });
}
