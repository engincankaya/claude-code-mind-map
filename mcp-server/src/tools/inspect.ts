import { type ArtifactStore } from "../lib/artifact-store.js";
import { handleParse } from "./parse.js";
import { handleSample } from "./sample.js";
import {
  type ToolResult,
  jsonResult,
  errorResult,
  parseJsonToolResult,
} from "../types.js";

interface ResolvedFile {
  fileId: string;
  absolutePath: string;
  canonicalPath: string;
  language: string;
  sizeBytes?: number;
}

interface DiscoveryResult {
  rootPath: string;
  resolvedFiles: {
    files: ResolvedFile[];
  };
}

interface InspectionResult {
  mode: "parse";
  discoveryArtifactId: string;
  parseArtifactId: string;
  depth: "summary" | "standard" | "detailed";
  processedFileIds: string[];
  parserMeta?: {
    treeSitterVersion: string;
    languagesUsed: string[];
    parseErrors: Array<{ fileId: string; error: string }>;
  };
}

interface ParseData {
  artifactId: string;
  files: unknown[];
  unresolvedImports: Array<{ fromFileId: string; rawSpecifier: string }>;
  pagination: {
    cursor?: string;
    hasMore: boolean;
    processedCount: number;
    totalCount: number;
  };
  parserMeta: InspectionResult["parserMeta"];
}

interface SampleData {
  fileId: string;
  canonicalPath: string;
  language: string;
  content: string;
  totalLines: number;
  range: { startLine: number; endLine: number };
}

interface InspectArgs {
  discoveryArtifactId: string;
  mode: "parse" | "sample";
  depth?: "summary" | "standard" | "detailed";
  targets?: {
    fileIds?: string[];
  };
  target?: {
    fileId: string;
    startLine?: number;
    endLine?: number;
    maxLines?: number;
  };
  options?: {
    maxSymbolsPerFile?: number;
    includeEvidence?: boolean;
    batchSize?: number;
    cursor?: string;
    appendToInspectionArtifactId?: string;
  };
}

export async function handleInspect(
  args: InspectArgs,
  store: ArtifactStore,
): Promise<ToolResult> {
  const discovery = store.getTyped<DiscoveryResult>(
    args.discoveryArtifactId,
    "discoveryResult",
  );
  if (!discovery) {
    return errorResult(
      `Discovery artifact ${args.discoveryArtifactId} not found`,
    );
  }

  const fileMap = new Map(
    discovery.resolvedFiles.files.map((file) => [file.fileId, file] as const),
  );

  try {
    if (args.mode === "sample") {
      const target = args.target;
      if (!target) {
        return errorResult("inspect sample mode requires target.fileId");
      }
      const resolved = fileMap.get(target.fileId);
      if (!resolved) {
        return errorResult(`File ${target.fileId} not found in discovery result`);
      }

      return await handleSample({
        rootPath: discovery.rootPath,
        fileId: resolved.fileId,
        absolutePath: resolved.absolutePath,
        startLine: target.startLine,
        endLine: target.endLine,
        maxLines: target.maxLines,
      });
    }

    const targetIds = args.targets?.fileIds;
    const files = targetIds?.length
      ? targetIds
          .map((fileId) => fileMap.get(fileId))
          .filter((file): file is ResolvedFile => Boolean(file))
      : discovery.resolvedFiles.files;

    let appendToArtifact: string | undefined;
    if (args.options?.appendToInspectionArtifactId) {
      const priorInspection = store.getTyped<InspectionResult>(
        args.options.appendToInspectionArtifactId,
        "inspectionResult",
      );
      if (!priorInspection) {
        return errorResult(
          `Inspection artifact ${args.options.appendToInspectionArtifactId} not found`,
        );
      }
      appendToArtifact = priorInspection.parseArtifactId;
    }

    const parseData = parseJsonToolResult<ParseData>(await handleParse(
      {
        rootPath: discovery.rootPath,
        files,
        depth: args.depth ?? "summary",
        options: {
          maxSymbolsPerFile: args.options?.maxSymbolsPerFile,
          includeEvidence: args.options?.includeEvidence,
          batchSize: args.options?.batchSize,
          cursor: args.options?.cursor,
          appendToArtifact,
        },
      },
      store,
    ));

    const inspectionResult: InspectionResult = {
      mode: "parse",
      discoveryArtifactId: args.discoveryArtifactId,
      parseArtifactId: parseData.artifactId,
      depth: args.depth ?? "summary",
      processedFileIds: files.map((file) => file.fileId),
      parserMeta: parseData.parserMeta,
    };

    const artifactId = store.put(
      "inspectionResult",
      inspectionResult,
      `Inspection: ${files.length} files, depth=${inspectionResult.depth}`,
    );

    return jsonResult({
      artifactId,
      mode: "parse",
      parseArtifactId: parseData.artifactId,
      summary: {
        processedFiles: files.length,
        depth: inspectionResult.depth,
        languagesUsed: parseData.parserMeta?.languagesUsed ?? [],
        parseErrors: parseData.parserMeta?.parseErrors.length ?? 0,
      },
      files: parseData.files,
      unresolvedImports: parseData.unresolvedImports,
      pagination: parseData.pagination,
      parserMeta: parseData.parserMeta,
    });
  } catch (err) {
    return errorResult(
      `inspect failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
