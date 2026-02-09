import { readFile, stat } from "node:fs/promises";
import { resolve, relative, normalize, extname } from "node:path";
import { type ToolResult, jsonResult, errorResult } from "../types.js";
import { fileId as makeFileId, sha256 } from "../lib/hashing.js";

/** Extension → language mapping */
const EXTENSION_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyi": "python",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".ex": "elixir",
  ".exs": "elixir",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".md": "markdown",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
  ".sql": "sql",
  ".sh": "shell",
  ".bash": "shell",
  ".zsh": "shell",
  ".dockerfile": "dockerfile",
  ".xml": "xml",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".proto": "protobuf",
  ".vue": "vue",
  ".svelte": "svelte",
};

function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (EXTENSION_MAP[ext]) return EXTENSION_MAP[ext];

  const base = filePath.split("/").pop()?.toLowerCase() ?? "";
  if (base === "dockerfile" || base.startsWith("dockerfile."))
    return "dockerfile";
  if (base === "makefile" || base === "gnumakefile") return "makefile";
  if (base === "gemfile" || base === "rakefile") return "ruby";
  if (base === "go.mod" || base === "go.sum") return "go";

  return "unknown";
}

interface ResolveArgs {
  rootPath: string;
  files: string[];
}

export async function handleResolve(args: ResolveArgs): Promise<ToolResult> {
  const { rootPath, files } = args;

  try {
    const resolved = await Promise.all(
      files.map(async (relPath) => {
        const absolutePath = resolve(rootPath, relPath);
        const canonicalPath = normalize(relative(rootPath, absolutePath));

        let contentHash = "";
        let sizeBytes = 0;
        try {
          const [content, fileStat] = await Promise.all([
            readFile(absolutePath, "utf-8"),
            stat(absolutePath),
          ]);
          contentHash = sha256(content);
          sizeBytes = fileStat.size;
        } catch {
          try {
            const fileStat = await stat(absolutePath);
            sizeBytes = fileStat.size;
            const buf = await readFile(absolutePath);
            contentHash = sha256(buf.toString("base64"));
          } catch {
            // unreadable file
          }
        }

        return {
          fileId: makeFileId(canonicalPath),
          absolutePath,
          canonicalPath,
          contentHash,
          ext: extname(relPath),
          language: detectLanguage(relPath),
          sizeBytes,
        };
      }),
    );

    return jsonResult({
      rootPath,
      files: resolved,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`resolve failed: ${message}`);
  }
}
