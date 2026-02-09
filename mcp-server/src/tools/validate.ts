import { type ArtifactStore } from "../lib/artifact-store.js";
import { type ToolResult, jsonResult, errorResult } from "../types.js";

interface ValidateArgs {
  mindmapArtifactId: string;
}

interface MindMapNode {
  id: string;
  parentId?: string;
  kind: string;
}

interface MindMapEdge {
  id: string;
  source: string;
  target: string;
}

interface MindMapJSON {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
}

interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export async function handleValidate(
  args: ValidateArgs,
  store: ArtifactStore,
): Promise<ToolResult> {
  const { mindmapArtifactId } = args;

  try {
    const mindmap = store.getTyped<MindMapJSON>(mindmapArtifactId, "mindmapJSON");
    if (!mindmap) {
      return errorResult(`Mindmap artifact ${mindmapArtifactId} not found`);
    }

    const issues: ValidationIssue[] = [];
    const nodeIds = new Set(mindmap.nodes.map((n) => n.id));

    // Check duplicate node IDs
    const seenNodeIds = new Set<string>();
    for (const node of mindmap.nodes) {
      if (seenNodeIds.has(node.id)) {
        issues.push({ severity: "error", code: "DUPLICATE_NODE", message: `Duplicate node ID: ${node.id}`, nodeId: node.id });
      }
      seenNodeIds.add(node.id);
    }

    // Check duplicate edge IDs
    const seenEdgeIds = new Set<string>();
    for (const edge of mindmap.edges) {
      if (seenEdgeIds.has(edge.id)) {
        issues.push({ severity: "error", code: "DUPLICATE_EDGE", message: `Duplicate edge ID: ${edge.id}`, edgeId: edge.id });
      }
      seenEdgeIds.add(edge.id);
    }

    // Check broken parent references
    for (const node of mindmap.nodes) {
      if (node.parentId && !nodeIds.has(node.parentId)) {
        issues.push({ severity: "error", code: "BROKEN_PARENT", message: `Node ${node.id} references missing parent ${node.parentId}`, nodeId: node.id });
      }
    }

    // Check broken edge references
    for (const edge of mindmap.edges) {
      if (!nodeIds.has(edge.source)) {
        issues.push({ severity: "error", code: "BROKEN_EDGE_SOURCE", message: `Edge ${edge.id} references missing source ${edge.source}`, edgeId: edge.id });
      }
      if (!nodeIds.has(edge.target)) {
        issues.push({ severity: "error", code: "BROKEN_EDGE_TARGET", message: `Edge ${edge.id} references missing target ${edge.target}`, edgeId: edge.id });
      }
    }

    // Check orphan nodes (no parent, not root)
    for (const node of mindmap.nodes) {
      if (node.kind !== "root" && !node.parentId) {
        issues.push({ severity: "warning", code: "ORPHAN_NODE", message: `Node ${node.id} has no parent`, nodeId: node.id });
      }
    }

    // Check self-referencing edges
    for (const edge of mindmap.edges) {
      if (edge.source === edge.target) {
        issues.push({ severity: "warning", code: "SELF_EDGE", message: `Edge ${edge.id} is self-referencing`, edgeId: edge.id });
      }
    }

    // Check root exists
    const hasRoot = mindmap.nodes.some((n) => n.kind === "root");
    if (!hasRoot) {
      issues.push({ severity: "error", code: "NO_ROOT", message: "No root node found" });
    }

    const errors = issues.filter((i) => i.severity === "error").length;
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const isValid = errors === 0;

    const report = { isValid, issues, summary: { errors, warnings, nodeCount: mindmap.nodes.length, edgeCount: mindmap.edges.length } };

    const artifactId = store.put("validationReport", report, `Validation: ${errors} errors, ${warnings} warnings`);

    return jsonResult({ artifactId, ...report });
  } catch (err) {
    return errorResult(`validate failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
