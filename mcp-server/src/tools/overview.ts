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

export interface MindMapNode {
  id: string;
  label: string;
  kind: "root" | "group" | "file" | "symbol";
  type: string;
  parentId?: string;
  metadata: Record<string, unknown>;
  confidence: number;
}

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  rels: string[];
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface MindMapJSON {
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

export type OverviewDepth = "minimal" | "standard" | "detailed";

export interface MindmapSourceArgs {
  selected_repo_id?: string;
  ref?: string;
  force_refresh?: boolean;
}

interface OverviewArgs extends MindmapSourceArgs {
  depth?: OverviewDepth;
}

export function getRoot(nodes: MindMapNode[]): MindMapNode | undefined {
  return nodes.find((n) => n.kind === "root");
}

export function getGroups(nodes: MindMapNode[]): MindMapNode[] {
  return nodes.filter((n) => n.kind === "group");
}

export function getFiles(nodes: MindMapNode[]): MindMapNode[] {
  return nodes.filter((n) => n.kind === "file");
}

export function getLanguages(files: MindMapNode[]): string[] {
  const langs = new Set<string>();
  for (const file of files) {
    const lang = file.metadata.language as string | undefined;
    if (lang) langs.add(lang);
  }
  return [...langs].sort();
}

export function nodePath(node: MindMapNode): string {
  return (node.metadata.canonicalPath as string | undefined) ?? node.label;
}

function highlightedFiles(files: MindMapNode[]): MindMapNode[] {
  return files.filter((file) => file.metadata.isHighlighted === true);
}

export async function loadMindmapRaw(
  args: MindmapSourceArgs,
): Promise<{ raw: string; source: string }> {
  if (!args.selected_repo_id) {
    const raw = await fs.readFile(MINDMAP_PATH, "utf-8");
    return { raw, source: MINDMAP_PATH };
  }

  const { owner, repo } = parseRepoId(args.selected_repo_id);
  const cacheKey = args.ref ? `${owner}/${repo}@${args.ref}` : `${owner}/${repo}`;

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

export async function loadMindmap(
  args: MindmapSourceArgs,
): Promise<{ mindmap: MindMapJSON; source: string }> {
  const { raw, source } = await loadMindmapRaw(args);
  const mindmap = JSON.parse(raw) as MindMapJSON;

  if (!mindmap.nodes || !mindmap.edges) {
    throw new Error("Invalid mind map JSON: missing nodes or edges");
  }

  return { mindmap, source };
}

function buildMinimal(mindmap: MindMapJSON) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const files = getFiles(mindmap.nodes);

  return {
    architecture: root?.label ?? "unknown",
    languages: getLanguages(files),
    stats: {
      files: files.length,
      groups: groups.length,
      edges: mindmap.edges.length,
    },
    groups: groups.map((group) => ({
      name: group.label,
      kind: group.type,
      fileCount: (group.metadata.fileCount as number) ?? 0,
    })),
  };
}

function buildStandard(mindmap: MindMapJSON) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const allFiles = getFiles(mindmap.nodes);

  const idToPath = new Map<string, string>();
  for (const file of allFiles) {
    idToPath.set(file.id, nodePath(file));
  }

  const groupResults = groups.map((group) => {
    const groupFiles = allFiles.filter((file) => file.parentId === group.id);
    const keyFiles = highlightedFiles(groupFiles);
    const otherFiles = groupFiles.filter((file) => file.metadata.isHighlighted !== true);

    return {
      name: group.label,
      kind: group.type,
      description: (group.metadata.description as string | undefined) ?? undefined,
      fileCount: groupFiles.length,
      keyFiles: keyFiles.map((file) => ({
        path: nodePath(file),
        role: (file.metadata.role as string | undefined) ?? file.type,
        description: (file.metadata.description as string | undefined) ?? undefined,
        importance: (file.metadata.importance as string | undefined) ?? "unknown",
      })),
      otherFiles: otherFiles.map((file) => ({
        path: nodePath(file),
        role: (file.metadata.role as string | undefined) ?? file.type,
        importance: (file.metadata.importance as string | undefined) ?? "unknown",
      })),
    };
  });

  const keyRelationships = mindmap.edges
    .filter((edge) => edge.label)
    .map((edge) => ({
      from: idToPath.get(edge.source) ?? edge.source,
      to: idToPath.get(edge.target) ?? edge.target,
      rel: edge.rels.join(", "),
      label: edge.label!,
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

function buildDetailed(mindmap: MindMapJSON) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const allFiles = getFiles(mindmap.nodes);

  const idToPath = new Map<string, string>();
  for (const file of allFiles) {
    idToPath.set(file.id, nodePath(file));
  }

  const groupResults = groups.map((group) => {
    const groupFiles = allFiles.filter((file) => file.parentId === group.id);

    return {
      name: group.label,
      kind: group.type,
      description: (group.metadata.description as string | undefined) ?? undefined,
      files: groupFiles.map((file) => ({
        path: nodePath(file),
        role: (file.metadata.role as string | undefined) ?? file.type,
        description: (file.metadata.description as string | undefined) ?? undefined,
        importance: (file.metadata.importance as string | undefined) ?? "unknown",
        isHighlighted: file.metadata.isHighlighted === true,
        confidence: file.confidence,
      })),
    };
  });

  const edges = mindmap.edges.map((edge) => {
    const result: Record<string, unknown> = {
      from: idToPath.get(edge.source) ?? edge.source,
      to: idToPath.get(edge.target) ?? edge.target,
      rels: edge.rels,
    };
    if (edge.label) result.label = edge.label;
    const symbols = (edge.metadata as { importedSymbols?: string[] } | undefined)
      ?.importedSymbols;
    if (symbols?.length) result.symbols = symbols;
    return result;
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

export function buildOverview(mindmap: MindMapJSON, depth: OverviewDepth = "standard") {
  switch (depth) {
    case "minimal":
      return buildMinimal(mindmap);
    case "standard":
      return buildStandard(mindmap);
    case "detailed":
      return buildDetailed(mindmap);
  }
}

export async function handleOverview(args: OverviewArgs): Promise<ToolResult> {
  const { depth = "standard" } = args;

  try {
    const { mindmap, source } = await loadMindmap(args);
    const result = buildOverview(mindmap, depth);
    return jsonResult({ source, ...result });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return errorResult(`Mind map file not found: ${MINDMAP_PATH}`);
    }
    return errorResult(
      `overview failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
