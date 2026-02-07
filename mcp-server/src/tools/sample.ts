import { type ToolResult, jsonResult } from "../types.js";

interface SampleArgs {
  rootPath: string;
  fileId: string;
  absolutePath: string;
  startLine?: number;
  endLine?: number;
  maxLines?: number;
}

export async function handleSample(args: SampleArgs): Promise<ToolResult> {
  // TODO: Implement file snippet reader
  return jsonResult({
    status: "not_implemented",
    tool: "mindmap.sample",
    receivedArgs: {
      fileId: args.fileId,
      startLine: args.startLine ?? 1,
      endLine: args.endLine ?? 50,
    },
  });
}
