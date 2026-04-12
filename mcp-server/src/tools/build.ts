import { type ArtifactStore } from "../lib/artifact-store.js";
import { sha256Short } from "../lib/hashing.js";
import { type ToolResult, jsonResult, errorResult } from "../types.js";

/** LLM tarafından üretilen mimari plan */
interface ArchitecturePlan {
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
}

interface ResolvedFile {
  fileId: string;
  canonicalPath: string;
  language: string;
  sizeBytes?: number;
}

interface BuildArgs {
  plan: ArchitecturePlan;
  parseArtifactId: string;
  resolvedFiles: { files: ResolvedFile[] };
  policy?: {
    edgeAggregation?: boolean;
    maxDepth?: number;
    collapseRules?: Array<{ pattern: string; action: string }>;
    includeSymbolNodes?: boolean;
    symbolNodeThreshold?: number;
  };
}

interface MindMapNode {
  id: string;
  label: string;
  kind: "root" | "group" | "file" | "symbol";
  type: string;
  parentId?: string;
  metadata: Record<string, unknown>;
  evidence?: { reason: string };
  confidence: number;
}

interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  rels: string[];
  label?: string;
  metadata?: Record<string, unknown>;
}

interface MindMapJSON {
  meta: {
    generatedAt: string;
    rootPath: string;
    view: string;
    nodeCount: number;
    edgeCount: number;
    toolVersions: { mcpServer: string; treeSitter: string };
  };
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

export async function handleBuild(
  args: BuildArgs,
  store: ArtifactStore,
): Promise<ToolResult> {
  const { plan, parseArtifactId, resolvedFiles, policy = {} } = args;
  const { edgeAggregation = true } = policy;

  try {
    // ParseResult'ı artifact store'dan oku
    const parseResult = store.get(parseArtifactId);
    if (!parseResult) {
      return errorResult(`Parse artifact ${parseArtifactId} not found`);
    }

    const fileMap = new Map<string, ResolvedFile>();
    for (const f of resolvedFiles.files) {
      fileMap.set(f.fileId, f);
    }

    const classMap = new Map<string, {
      role: string;
      confidence: number;
      importance: string;
      description?: string;
    }>();
    for (const c of plan.fileClassifications) {
      classMap.set(c.fileId, {
        role: c.role,
        confidence: c.confidence,
        importance: c.importance ?? "supporting",
        description: c.description,
      });
    }

    const highlightedFileIds = new Set<string>();
    for (const group of plan.groups) {
      for (const fileId of group.highlightFileIds ?? []) {
        highlightedFileIds.add(fileId);
      }
    }

    const nodes: MindMapNode[] = [];
    const edges: MindMapEdge[] = [];

    // Root node
    const rootId = "root";
    nodes.push({
      id: rootId,
      label: plan.architecturePattern,
      kind: "root",
      type: "architecture",
      metadata: { pattern: plan.architecturePattern },
      confidence: 1.0,
    });

    // Group nodes
    for (const group of plan.groups) {
      const groupId = `g-${sha256Short(group.label)}`;
      nodes.push({
        id: groupId,
        label: group.label,
        kind: "group",
        type: group.kind,
        parentId: rootId,
        metadata: {
          description: group.description,
          fileCount: group.fileIds.length,
          highlightFileCount: (group.highlightFileIds ?? []).length,
        },
        confidence: 1.0,
      });

      // File nodes under this group
      for (const fileId of group.fileIds) {
        const resolved = fileMap.get(fileId);
        const classification = classMap.get(fileId);
        if (!resolved) continue;

        const fileNodeId = `f-${fileId}`;
        nodes.push({
          id: fileNodeId,
          label: resolved.canonicalPath.split("/").pop() ?? resolved.canonicalPath,
          kind: "file",
          type: classification?.role ?? "unknown",
          parentId: groupId,
          metadata: {
            canonicalPath: resolved.canonicalPath,
            fileId,
            language: resolved.language,
            role: classification?.role,
            importance: classification?.importance,
            isHighlighted: highlightedFileIds.has(fileId),
            description: highlightedFileIds.has(fileId)
              ? classification?.description
              : undefined,
          },
          confidence: classification?.confidence ?? 0.5,
        });
      }
    }

    // Edges from parse data (imports)
    const parsedData = parseResult.data as { files?: Array<{ fileId: string; imports?: Array<{ rawSpecifier: string; importedSymbols?: string[] }> }> };
    const parsedFiles = parsedData.files ?? [];
    const fileIdSet = new Set(resolvedFiles.files.map((f) => f.fileId));

    // Build canonical path → fileId map for import resolution
    const pathToFileId = new Map<string, string>();
    for (const f of resolvedFiles.files) {
      pathToFileId.set(f.canonicalPath, f.fileId);
      // Also without extension
      const noExt = f.canonicalPath.replace(/\.[^.]+$/, "");
      pathToFileId.set(noExt, f.fileId);
    }

    const edgeMap = new Map<string, MindMapEdge>();

    for (const file of parsedFiles) {
      if (!file.imports) continue;
      const sourceNodeId = `f-${file.fileId}`;

      for (const imp of file.imports) {
        // Try to resolve relative imports to a fileId
        let targetFileId: string | undefined;
        for (const [path, fid] of pathToFileId) {
          if (imp.rawSpecifier.endsWith(path) || path.endsWith(imp.rawSpecifier.replace(/^\.\//, ""))) {
            targetFileId = fid;
            break;
          }
        }

        if (!targetFileId || !fileIdSet.has(targetFileId)) continue;
        const targetNodeId = `f-${targetFileId}`;

        const edgeKey = edgeAggregation
          ? `${sourceNodeId}->${targetNodeId}`
          : `${sourceNodeId}->${targetNodeId}:${imp.rawSpecifier}`;

        const existing = edgeMap.get(edgeKey);
        if (existing) {
          // Aggregate imported symbols
          const syms = imp.importedSymbols ?? [];
          const meta = existing.metadata as { importedSymbols?: string[] } | undefined;
          if (meta?.importedSymbols) {
            for (const s of syms) {
              if (!meta.importedSymbols.includes(s)) meta.importedSymbols.push(s);
            }
          }
        } else {
          edgeMap.set(edgeKey, {
            id: `e-${sha256Short(edgeKey)}`,
            source: sourceNodeId,
            target: targetNodeId,
            rels: ["imports"],
            metadata: { importedSymbols: imp.importedSymbols },
          });
        }
      }
    }

    // LLM-annotated relationships
    if (plan.relationships) {
      for (const rel of plan.relationships) {
        const sourceNodeId = `f-${rel.sourceFileId}`;
        const targetNodeId = `f-${rel.targetFileId}`;
        const edgeKey = `${sourceNodeId}->${targetNodeId}:llm`;

        edgeMap.set(edgeKey, {
          id: `e-${sha256Short(edgeKey)}`,
          source: sourceNodeId,
          target: targetNodeId,
          rels: rel.rels,
          label: rel.annotation,
          metadata: { annotation: rel.annotation },
        });
      }
    }

    edges.push(...edgeMap.values());

    // Build MindMapJSON
    const mindmap: MindMapJSON = {
      meta: {
        generatedAt: new Date().toISOString(),
        rootPath: "",
        view: plan.presentationOptions?.viewType ?? "default",
        nodeCount: nodes.length,
        edgeCount: edges.length,
        toolVersions: { mcpServer: "0.1.0", treeSitter: "0.24" },
      },
      nodes,
      edges,
    };

    // Store in artifact store
    const artifactId = store.put("mindmapJSON", mindmap, `MindMap: ${nodes.length} nodes, ${edges.length} edges`);

    // Edge breakdown
    const edgeBreakdown: Record<string, number> = {};
    for (const edge of edges) {
      for (const rel of edge.rels) {
        edgeBreakdown[rel] = (edgeBreakdown[rel] ?? 0) + 1;
      }
    }

    const topGroups = plan.groups.map((g) => ({ label: g.label, fileCount: g.fileIds.length }));
    const languages = [...new Set(resolvedFiles.files.map((f) => f.language))];

    return jsonResult({
      artifactId,
      summary: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        groupCount: plan.groups.length,
        maxDepth: 2,
        languages,
        topGroups,
        edgeBreakdown,
      },
    });
  } catch (err) {
    return errorResult(`build failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
