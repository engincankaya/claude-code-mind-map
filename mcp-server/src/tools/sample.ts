import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { type ToolResult, jsonResult, errorResult } from "../types.js";

interface SampleArgs {
  rootPath: string;
  fileId: string;
  absolutePath: string;
  startLine?: number;
  endLine?: number;
  maxLines?: number;
}

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".py": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
};

export async function handleSample(args: SampleArgs): Promise<ToolResult> {
  const {
    fileId,
    absolutePath,
    startLine = 1,
    endLine = 50,
    maxLines = 100,
  } = args;

  try {
    const content = await readFile(absolutePath, "utf-8");
    const allLines = content.split("\n");
    const totalLines = allLines.length;

    const start = Math.max(1, startLine);
    const end = Math.min(totalLines, endLine, start + maxLines - 1);
    const snippet = allLines.slice(start - 1, end).join("\n");

    const ext = extname(absolutePath).toLowerCase();
    const language = EXT_TO_LANG[ext] ?? "unknown";

    // Relative path from rootPath
    const canonicalPath = absolutePath.startsWith(args.rootPath)
      ? absolutePath.slice(args.rootPath.length + 1)
      : absolutePath;

    return jsonResult({
      fileId,
      canonicalPath,
      language,
      content: snippet,
      totalLines,
      range: { startLine: start, endLine: end },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`sample failed: ${message}`);
  }
}
