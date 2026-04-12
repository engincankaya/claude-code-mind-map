import { type ArtifactStore } from "../lib/artifact-store.js";
import { handleBuild } from "./build.js";
import { handlePublish } from "./publish.js";
import { handleValidate } from "./validate.js";
import {
  type ToolResult,
  errorResult,
  parseJsonToolResult,
} from "../types.js";

interface ResolvedFile {
  fileId: string;
  canonicalPath: string;
  language: string;
  sizeBytes?: number;
}

interface DiscoveryResult {
  rootPath: string;
  resolvedFiles: {
    files: Array<ResolvedFile & { absolutePath: string }>;
  };
}

interface InspectionResult {
  mode: "parse";
  parseArtifactId: string;
}

interface ValidationData {
  artifactId: string;
  isValid: boolean;
  summary: {
    errors: number;
    warnings: number;
    nodeCount: number;
    edgeCount: number;
  };
}

interface BuildData {
  artifactId: string;
  summary: {
    nodeCount: number;
    edgeCount: number;
    groupCount: number;
    maxDepth: number;
    languages: string[];
    topGroups: Array<{ label: string; fileCount: number }>;
    edgeBreakdown: Record<string, number>;
  };
}

interface GenerateArgs {
  discoveryArtifactId: string;
  inspectionArtifactId: string;
  plan: {
    architecturePattern: string;
    fileClassifications: Array<{
      fileId: string;
      role: string;
      confidence: number;
      importance?: "core" | "supporting" | "peripheral";
      description?: string;
    }>;
    groups: Array<{
      label: string;
      kind: "layer" | "domain" | "feature" | "infrastructure" | "other";
      fileIds: string[];
      description?: string;
      highlightFileIds?: string[];
    }>;
    relationships?: Array<{
      sourceFileId: string;
      targetFileId: string;
      rels: string[];
      annotation?: string;
    }>;
    presentationOptions?: {
      viewType?: string;
      collapseRules?: Array<{ pattern: string; action: string }>;
    };
  };
  options?: {
    validate?: boolean;
    writePath?: string;
    format?: "pretty" | "compact";
    edgeAggregation?: boolean;
  };
}

export async function handleGenerate(
  args: GenerateArgs,
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

  const inspection = store.getTyped<InspectionResult>(
    args.inspectionArtifactId,
    "inspectionResult",
  );
  if (!inspection || inspection.mode !== "parse") {
    return errorResult(
      `Inspection artifact ${args.inspectionArtifactId} is missing or not parse-based`,
    );
  }

  try {
    const buildData = parseJsonToolResult<BuildData>(await handleBuild({
      plan: args.plan,
      parseArtifactId: inspection.parseArtifactId,
      resolvedFiles: {
        files: discovery.resolvedFiles.files.map((file) => ({
          fileId: file.fileId,
          canonicalPath: file.canonicalPath,
          language: file.language,
          sizeBytes: file.sizeBytes,
        })),
      },
      policy: {
        edgeAggregation: args.options?.edgeAggregation,
      },
    }, store));

    let validationData: ValidationData | undefined;
    if (args.options?.validate !== false) {
      validationData = parseJsonToolResult<ValidationData>(await handleValidate({
        mindmapArtifactId: buildData.artifactId,
      }, store));
    }

    const publishResult = await handlePublish({
      mindmapArtifactId: buildData.artifactId,
      validationArtifactId: validationData?.artifactId,
      options: {
        writePath: args.options?.writePath,
        format: args.options?.format,
      },
    }, store);

    const publishText = publishResult.content[0]?.text ?? "Mind map published";
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          artifactId: buildData.artifactId,
          validation: validationData
            ? {
                isValid: validationData.isValid,
                errors: validationData.summary.errors,
                warnings: validationData.summary.warnings,
              }
            : undefined,
          summary: buildData.summary,
          message: publishText,
        }, null, 2),
      }],
      structuredContent: publishResult.structuredContent,
    };
  } catch (err) {
    return errorResult(
      `generate failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
