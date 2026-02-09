import fg from "fast-glob";
import { type ToolResult, jsonResult, errorResult } from "../types.js";

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/__pycache__/**",
  "**/.venv/**",
  "**/venv/**",
  "**/vendor/**",
  "**/target/**",
  "**/bin/**",
  "**/obj/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.cache/**",
  "**/.turbo/**",
  "**/.output/**",
  "**/out/**",
  "**/*.min.js",
  "**/*.min.css",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/.DS_Store",
];

interface ScanArgs {
  rootPath: string;
  ignore?: string[];
  maxFiles?: number;
}

export async function handleScan(args: ScanArgs): Promise<ToolResult> {
  const { rootPath, ignore = [], maxFiles = 10000 } = args;

  const allIgnore = [...DEFAULT_IGNORE, ...ignore];

  try {
    const files = await fg("**/*", {
      cwd: rootPath,
      ignore: allIgnore,
      onlyFiles: true,
      dot: false,
      absolute: false,
      suppressErrors: true,
    });

    // Sort for deterministic output
    files.sort();

    const limited = files.slice(0, maxFiles);

    return jsonResult({
      rootPath,
      files: limited,
      stats: {
        total: files.length,
        included: limited.length,
        ignored: files.length - limited.length,
        truncated: files.length > maxFiles,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`scan failed: ${message}`);
  }
}
