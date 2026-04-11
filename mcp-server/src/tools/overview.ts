import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { type ToolResult, jsonResult, errorResult } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MINDMAP_PATH = path.resolve(__dirname, "../../..", "mindmap-output.json");

interface MindMapNode {
  id: string;
  label: string;
  kind: "root" | "group" | "file" | "symbol";
  type: string;
  parentId?: string;
  metadata: Record<string, unknown>;
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

type Depth = "minimal" | "standard" | "detailed";

interface OverviewArgs {
  depth?: Depth;
  focus?: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function getRoot(nodes: MindMapNode[]): MindMapNode | undefined {
  return nodes.find((n) => n.kind === "root");
}

function getGroups(nodes: MindMapNode[]): MindMapNode[] {
  return nodes.filter((n) => n.kind === "group");
}

function getFiles(nodes: MindMapNode[]): MindMapNode[] {
  return nodes.filter((n) => n.kind === "file");
}

function getLanguages(files: MindMapNode[]): string[] {
  const langs = new Set<string>();
  for (const f of files) {
    const lang = f.metadata.language as string | undefined;
    if (lang) langs.add(lang);
  }
  return [...langs].sort();
}

function filesByImportance(
  files: MindMapNode[],
  importance: string,
): MindMapNode[] {
  return files.filter((f) => f.metadata.importance === importance);
}

// ─── Depth: minimal ─────────────────────────────────────────────

function buildMinimal(mindmap: MindMapJSON, focus?: string) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const files = getFiles(mindmap.nodes);

  const filteredGroups = focus
    ? groups.filter((g) => g.label.toLowerCase().includes(focus.toLowerCase()))
    : groups;

  return {
    architecture: root?.label ?? "unknown",
    languages: getLanguages(files),
    stats: {
      files: files.length,
      groups: groups.length,
      edges: mindmap.edges.length,
    },
    groups: filteredGroups.map((g) => ({
      name: g.label,
      kind: g.type,
      fileCount: (g.metadata.fileCount as number) ?? 0,
    })),
  };
}

// ─── Depth: standard ────────────────────────────────────────────

function buildStandard(mindmap: MindMapJSON, focus?: string) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const allFiles = getFiles(mindmap.nodes);

  const filteredGroups = focus
    ? groups.filter((g) => g.label.toLowerCase().includes(focus.toLowerCase()))
    : groups;

  // Node ID → canonical path map
  const idToPath = new Map<string, string>();
  for (const f of allFiles) {
    idToPath.set(f.id, (f.metadata.canonicalPath as string) ?? f.label);
  }

  const groupResults = filteredGroups.map((g) => {
    const groupFiles = allFiles.filter((f) => f.parentId === g.id);
    const core = filesByImportance(groupFiles, "core");
    const supporting = filesByImportance(groupFiles, "supporting");

    return {
      name: g.label,
      kind: g.type,
      description: (g.metadata.description as string) ?? undefined,
      fileCount: groupFiles.length,
      coreFiles: core.map((f) => ({
        path: (f.metadata.canonicalPath as string) ?? f.label,
        role: (f.metadata.role as string) ?? f.type,
      })),
      supportingFiles: supporting.map(
        (f) => (f.metadata.canonicalPath as string) ?? f.label,
      ),
    };
  });

  // Focused file IDs (for edge filtering)
  const focusedFileIds = focus
    ? new Set(filteredGroups.flatMap((g) =>
        allFiles.filter((f) => f.parentId === g.id).map((f) => f.id),
      ))
    : null;

  // Key relationships: only labeled/annotated edges, filtered by focus
  const keyRelationships = mindmap.edges
    .filter((e) => e.label)
    .filter((e) => !focusedFileIds || focusedFileIds.has(e.source) || focusedFileIds.has(e.target))
    .map((e) => ({
      from: idToPath.get(e.source) ?? e.source,
      to: idToPath.get(e.target) ?? e.target,
      rel: e.rels.join(", "),
      label: e.label!,
    }));

  return {
    architecture: root?.label ?? "unknown",
    languages: getLanguages(allFiles),
    stats: {
      files: allFiles.length,
      groups: groups.length,
      edges: mindmap.edges.length,
    },
    groups: groupResults,
    keyRelationships,
  };
}

// ─── Depth: detailed ────────────────────────────────────────────

function buildDetailed(mindmap: MindMapJSON, focus?: string) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const allFiles = getFiles(mindmap.nodes);

  const filteredGroups = focus
    ? groups.filter((g) => g.label.toLowerCase().includes(focus.toLowerCase()))
    : groups;

  // Node ID → canonical path map
  const idToPath = new Map<string, string>();
  for (const f of allFiles) {
    idToPath.set(f.id, (f.metadata.canonicalPath as string) ?? f.label);
  }

  const groupResults = filteredGroups.map((g) => {
    const groupFiles = allFiles.filter((f) => f.parentId === g.id);

    return {
      name: g.label,
      kind: g.type,
      description: (g.metadata.description as string) ?? undefined,
      files: groupFiles.map((f) => ({
        path: (f.metadata.canonicalPath as string) ?? f.label,
        role: (f.metadata.role as string) ?? f.type,
        importance: (f.metadata.importance as string) ?? "unknown",
        confidence: f.confidence,
      })),
    };
  });

  // Focused file IDs (for edge filtering)
  const focusedFileIds = focus
    ? new Set(filteredGroups.flatMap((g) =>
        allFiles.filter((f) => f.parentId === g.id).map((f) => f.id),
      ))
    : null;

  // All edges with readable paths, filtered by focus
  const edges = mindmap.edges
    .filter((e) => !focusedFileIds || focusedFileIds.has(e.source) || focusedFileIds.has(e.target))
    .map((e) => {
      const edge: Record<string, unknown> = {
        from: idToPath.get(e.source) ?? e.source,
        to: idToPath.get(e.target) ?? e.target,
        rels: e.rels,
      };
      if (e.label) edge.label = e.label;
      const symbols = (e.metadata as { importedSymbols?: string[] })
        ?.importedSymbols;
      if (symbols?.length) edge.symbols = symbols;
      return edge;
    });

  return {
    architecture: root?.label ?? "unknown",
    languages: getLanguages(allFiles),
    stats: {
      files: allFiles.length,
      groups: groups.length,
      edges: mindmap.edges.length,
    },
    groups: groupResults,
    edges,
  };
}

// ─── Handler ────────────────────────────────────────────────────

export async function handleOverview(args: OverviewArgs): Promise<ToolResult> {
  const { depth = "standard", focus } = args;
  const filePath = MINDMAP_PATH;

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const mindmap: MindMapJSON = JSON.parse(raw);

    if (!mindmap.nodes || !mindmap.edges) {
      return errorResult("Invalid mind map JSON: missing nodes or edges");
    }

    let result: unknown;
    switch (depth) {
      case "minimal":
        result = buildMinimal(mindmap, focus);
        break;
      case "standard":
        result = buildStandard(mindmap, focus);
        break;
      case "detailed":
        result = buildDetailed(mindmap, focus);
        break;
    }

    return jsonResult(result);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return errorResult(`Mind map file not found: ${filePath}`);
    }
    return errorResult(
      `overview failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
