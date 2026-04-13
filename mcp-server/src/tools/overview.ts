import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import { type ToolResult, jsonResult, errorResult } from "../types.js";
import { fetchGithubFileRaw, parseRepoId } from "../lib/github-fetch.js";
import { readCache, writeCache, cachePathFor } from "../lib/mindmap-cache.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MINDMAP_PATH = path.resolve(__dirname, "../../..", "mindmap-output.json");
const MINDMAP_FILE_IN_REPO = "mindmap-output.json";

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
  selected_repo_id?: string;
  ref?: string;
  force_refresh?: boolean;
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

function highlightedFiles(files: MindMapNode[]): MindMapNode[] {
  return files.filter((f) => f.metadata.isHighlighted === true);
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
    const keyFiles = highlightedFiles(groupFiles);
    const otherFiles = groupFiles.filter((f) => f.metadata.isHighlighted !== true);

    return {
      name: g.label,
      kind: g.type,
      description: (g.metadata.description as string) ?? undefined,
      fileCount: groupFiles.length,
      keyFiles: keyFiles.map((f) => ({
        path: (f.metadata.canonicalPath as string) ?? f.label,
        role: (f.metadata.role as string) ?? f.type,
        description: (f.metadata.description as string) ?? undefined,
        importance: (f.metadata.importance as string) ?? "unknown",
      })),
      otherFiles: otherFiles.map((f) => ({
        path: (f.metadata.canonicalPath as string) ?? f.label,
        role: (f.metadata.role as string) ?? f.type,
        importance: (f.metadata.importance as string) ?? "unknown",
      })),
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
        description: (f.metadata.description as string) ?? undefined,
        importance: (f.metadata.importance as string) ?? "unknown",
        isHighlighted: f.metadata.isHighlighted === true,
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

async function loadMindmapRaw(args: OverviewArgs): Promise<{ raw: string; source: string }> {
  if (!args.selected_repo_id) {
    const raw = await fs.readFile(MINDMAP_PATH, "utf-8");
    return { raw, source: MINDMAP_PATH };
  }

  const { owner, repo } = parseRepoId(args.selected_repo_id);
  const cacheKey = args.ref
    ? `${owner}/${repo}@${args.ref}`
    : `${owner}/${repo}`;

  if (!args.force_refresh) {
    const cached = await readCache(cacheKey);
    if (cached !== null) {
      return { raw: cached, source: `cache:${cachePathFor(cacheKey)}` };
    }
  }

  const raw = await fetchGithubFileRaw({
    owner,
    repo,
    path: MINDMAP_FILE_IN_REPO,
    ref: args.ref,
  });
  await writeCache(cacheKey, raw);
  return { raw, source: `github:${owner}/${repo}${args.ref ? `@${args.ref}` : ""}` };
}

export async function handleOverview(args: OverviewArgs): Promise<ToolResult> {
  const { depth = "standard", focus } = args;

  let raw: string;
  let source: string;
  try {
    ({ raw, source } = await loadMindmapRaw(args));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return errorResult(`Mind map file not found: ${MINDMAP_PATH}`);
    }
    return errorResult(
      `overview failed to load mindmap: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
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

    return jsonResult({ source, ...(result as object) });
  } catch (err) {
    return errorResult(
      `overview failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
