import { type ArtifactStore } from "../lib/artifact-store.js";
import { handleContext } from "./context.js";
import { handleResolve } from "./resolve.js";
import { handleScan } from "./scan.js";
import {
  type ToolResult,
  jsonResult,
  errorResult,
  parseJsonToolResult,
} from "../types.js";

interface DiscoverArgs {
  rootPath: string;
  ignore?: string[];
  maxFiles?: number;
}

interface ScanData {
  rootPath: string;
  files: string[];
  stats: {
    total: number;
    included: number;
    ignored: number;
    truncated: boolean;
  };
}

interface ResolvedFile {
  fileId: string;
  absolutePath: string;
  canonicalPath: string;
  contentHash: string;
  ext: string;
  language: string;
  sizeBytes: number;
}

interface ResolveData {
  rootPath: string;
  files: ResolvedFile[];
}

interface ContextData {
  rootPath: string;
  projectFiles: {
    readme?: string;
    packageManagers: Array<{
      type: string;
      filePath: string;
      name?: string;
      dependencies?: string[];
      scripts?: Record<string, string>;
    }>;
    configs: Array<{ filePath: string; type: string; summary: string }>;
    entryPoints: string[];
  };
  folderStructure: {
    topLevelDirs: string[];
    maxDepth: number;
    totalDirs: number;
  };
  repoMeta: {
    primaryLanguages: Array<{
      language: string;
      fileCount: number;
      percentage: number;
    }>;
    totalFiles: number;
    totalSizeBytes: number;
  };
}

interface DiscoveryResult {
  rootPath: string;
  scan: ScanData;
  resolvedFiles: ResolveData;
  context: ContextData;
}

export async function handleDiscover(
  args: DiscoverArgs,
  store: ArtifactStore,
): Promise<ToolResult> {
  try {
    const scanData = parseJsonToolResult<ScanData>(await handleScan(args));
    const resolveData = parseJsonToolResult<ResolveData>(await handleResolve({
      rootPath: args.rootPath,
      files: scanData.files,
    }));
    const contextData = parseJsonToolResult<ContextData>(await handleContext({
      rootPath: args.rootPath,
    }));

    const discovery: DiscoveryResult = {
      rootPath: args.rootPath,
      scan: scanData,
      resolvedFiles: resolveData,
      context: contextData,
    };

    const artifactId = store.put(
      "discoveryResult",
      discovery,
      `Discovery: ${resolveData.files.length} files`,
    );

    const supportedSourceFiles = resolveData.files.filter(
      (file) => file.language !== "unknown",
    );

    return jsonResult({
      artifactId,
      summary: {
        totalFiles: scanData.stats.included,
        supportedSourceFiles: supportedSourceFiles.length,
        entryPoints: contextData.projectFiles.entryPoints,
        topLevelDirs: contextData.folderStructure.topLevelDirs,
        primaryLanguages: contextData.repoMeta.primaryLanguages,
      },
      resolvedFiles: {
        files: resolveData.files.map((file) => ({
          fileId: file.fileId,
          canonicalPath: file.canonicalPath,
          absolutePath: file.absolutePath,
          language: file.language,
          sizeBytes: file.sizeBytes,
        })),
      },
      context: contextData,
    });
  } catch (err) {
    return errorResult(
      `discover failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
