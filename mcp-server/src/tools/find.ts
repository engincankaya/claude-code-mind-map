import { type ToolResult, jsonResult, errorResult } from "../types.js";
import {
  type MindMapEdge,
  type MindMapJSON,
  type MindMapNode,
  type MindmapSourceArgs,
  getFiles,
  getGroups,
  getLanguages,
  getRoot,
  loadMindmap,
  nodePath,
} from "./overview.js";

type FindDepth = "standard" | "detailed";

interface FindArgs extends MindmapSourceArgs {
  query: string;
  depth?: FindDepth;
}

interface QueryMatch {
  requested: string;
  matched: boolean;
  strategy: "direct" | "token" | "no-match";
  terms: string[];
  matchedGroups: string[];
  matchedFiles: string[];
  suggestions: string[];
  note?: string;
}

interface FindContext {
  query: QueryMatch;
  groups: MindMapNode[];
  fileIds: Set<string> | null;
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(" ");
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map(textValue)
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function nodeSearchText(node: MindMapNode): string {
  return [
    node.label,
    node.type,
    textValue(node.metadata.role),
    textValue(node.metadata.description),
    textValue(node.metadata.canonicalPath),
    textValue(node.metadata.language),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function edgeSearchText(edge: MindMapEdge): string {
  return [
    edge.label,
    edge.rels.join(" "),
    textValue(edge.metadata),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function queryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function scoreText(text: string, query: string, terms: string[]): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return 0;
  if (lowerText.includes(lowerQuery)) return 100 + lowerQuery.length;

  let score = 0;
  for (const term of terms) {
    if (lowerText.includes(term)) score += term.length;
  }
  return score;
}

function buildFindContext(mindmap: MindMapJSON, query: string): FindContext {
  const groups = getGroups(mindmap.nodes);
  const files = getFiles(mindmap.nodes);
  const requested = query.trim();
  const terms = queryTerms(requested);

  const groupScores = groups
    .map((group) => ({
      group,
      score: scoreText(nodeSearchText(group), requested, terms),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const fileScores = files
    .map((file) => ({
      file,
      score: scoreText(nodeSearchText(file), requested, terms),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const matchedGroupIds = new Set(groupScores.map((entry) => entry.group.id));
  const matchedFileIds = new Set(fileScores.map((entry) => entry.file.id));

  for (const file of fileScores.map((entry) => entry.file)) {
    if (file.parentId) matchedGroupIds.add(file.parentId);
  }

  for (const edge of mindmap.edges) {
    if (scoreText(edgeSearchText(edge), requested, terms) > 0) {
      matchedFileIds.add(edge.source);
      matchedFileIds.add(edge.target);
      const source = files.find((file) => file.id === edge.source);
      const target = files.find((file) => file.id === edge.target);
      if (source?.parentId) matchedGroupIds.add(source.parentId);
      if (target?.parentId) matchedGroupIds.add(target.parentId);
    }
  }

  const matchedGroups = groups.filter((group) => matchedGroupIds.has(group.id));
  const directMatch = groupScores.some((entry) => entry.score >= 100)
    || fileScores.some((entry) => entry.score >= 100);

  if (matchedGroups.length > 0 || matchedFileIds.size > 0) {
    const expandedFileIds = new Set([
      ...matchedFileIds,
      ...files
        .filter((file) => file.parentId && matchedGroupIds.has(file.parentId))
        .map((file) => file.id),
    ]);

    return {
      groups: matchedGroups,
      fileIds: expandedFileIds,
      query: {
        requested,
        matched: true,
        strategy: directMatch ? "direct" : "token",
        terms,
        matchedGroups: matchedGroups.map((group) => group.label),
        matchedFiles: fileScores.slice(0, 12).map((entry) => nodePath(entry.file)),
        suggestions: [],
      },
    };
  }

  return {
    groups,
    fileIds: null,
    query: {
      requested,
      matched: false,
      strategy: "no-match",
      terms,
      matchedGroups: [],
      matchedFiles: [],
      suggestions: groups.slice(0, 8).map((group) => group.label),
      note:
        "No group, file, or relationship matched the query. Returning the full overview so the caller can choose a better query.",
    },
  };
}

function buildIdToPath(files: MindMapNode[]): Map<string, string> {
  const idToPath = new Map<string, string>();
  for (const file of files) {
    idToPath.set(file.id, nodePath(file));
  }
  return idToPath;
}

function buildFindStandard(mindmap: MindMapJSON, context: FindContext) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const files = getFiles(mindmap.nodes);
  const idToPath = buildIdToPath(files);

  const groupResults = context.groups.map((group) => {
    const groupFiles = files.filter((file) => file.parentId === group.id);
    const keyFiles = groupFiles.filter((file) => file.metadata.isHighlighted === true);
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
    .filter((edge) =>
      !context.fileIds
        || context.fileIds.has(edge.source)
        || context.fileIds.has(edge.target),
    )
    .map((edge) => ({
      from: idToPath.get(edge.source) ?? edge.source,
      to: idToPath.get(edge.target) ?? edge.target,
      rel: edge.rels.join(", "),
      label: edge.label!,
    }));

  return {
    query: context.query,
    architecture: root?.label ?? "unknown",
    languages: getLanguages(files),
    stats: {
      files: files.length,
      groups: groups.length,
      edges: mindmap.edges.length,
    },
    groups: groupResults,
    keyRelationships,
  };
}

function buildFindDetailed(mindmap: MindMapJSON, context: FindContext) {
  const root = getRoot(mindmap.nodes);
  const groups = getGroups(mindmap.nodes);
  const files = getFiles(mindmap.nodes);
  const idToPath = buildIdToPath(files);

  const groupResults = context.groups.map((group) => {
    const groupFiles = files.filter((file) => file.parentId === group.id);

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

  const edges = mindmap.edges
    .filter((edge) =>
      !context.fileIds
        || context.fileIds.has(edge.source)
        || context.fileIds.has(edge.target),
    )
    .map((edge) => {
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
    query: context.query,
    architecture: root?.label ?? "unknown",
    languages: getLanguages(files),
    stats: {
      files: files.length,
      groups: groups.length,
      edges: mindmap.edges.length,
    },
    groups: groupResults,
    edges,
  };
}

export function buildFind(
  mindmap: MindMapJSON,
  query: string,
  depth: FindDepth = "standard",
) {
  const context = buildFindContext(mindmap, query);
  if (depth === "detailed") return buildFindDetailed(mindmap, context);
  return buildFindStandard(mindmap, context);
}

export async function handleFind(args: FindArgs): Promise<ToolResult> {
  const { query, depth = "standard" } = args;

  if (!query?.trim()) {
    return errorResult("find failed: query is required");
  }

  try {
    const { mindmap, source } = await loadMindmap(args);
    const result = buildFind(mindmap, query, depth);
    return jsonResult({ source, ...result });
  } catch (err) {
    return errorResult(
      `find failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
