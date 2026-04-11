import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ArtifactStore } from "./lib/artifact-store.js";
import { handleScan } from "./tools/scan.js";
import { handleResolve } from "./tools/resolve.js";
import { handleContext } from "./tools/context.js";
import { handleParse } from "./tools/parse.js";
import { handleSample } from "./tools/sample.js";
import { handleBuild } from "./tools/build.js";
import { handleValidate } from "./tools/validate.js";
import { handlePublish } from "./tools/publish.js";
import { handleOverview } from "./tools/overview.js";

const artifactStore = new ArtifactStore();

const server = new McpServer({
  name: "mindmap",
  version: "0.1.0",
});

// ─── Tool 1: mindmap.scan ───────────────────────────────────────
server.registerTool(
  "mindmap.scan",
  {
    title: "Scan Repository",
    description:
      "List all source files in a repository with stats. " +
      "Applies default ignore patterns (node_modules, .git, dist, etc.)",
    inputSchema: {
      rootPath: z.string().describe("Absolute path to repository root"),
      ignore: z
        .array(z.string())
        .optional()
        .describe("Additional glob patterns to ignore"),
      maxFiles: z
        .number()
        .optional()
        .default(10000)
        .describe("Maximum files to return (safety limit)"),
    },
  },
  async (args) => handleScan(args),
);

// ─── Tool 2: mindmap.resolve ────────────────────────────────────
server.registerTool(
  "mindmap.resolve",
  {
    title: "Resolve Files",
    description:
      "Canonicalize file paths, produce stable deterministic IDs, " +
      "content hashes, detect language by extension. Raw facts only.",
    inputSchema: {
      rootPath: z.string().describe("Absolute path to repository root"),
      files: z
        .array(z.string())
        .describe("Relative file paths from scan output"),
    },
  },
  async (args) => handleResolve(args),
);

// ─── Tool 3: mindmap.context ────────────────────────────────────
server.registerTool(
  "mindmap.context",
  {
    title: "Project Context",
    description:
      "Extract project-level metadata: README, package managers, " +
      "configs, entry points, folder structure, language stats.",
    inputSchema: {
      rootPath: z.string().describe("Absolute path to repository root"),
    },
  },
  async (args) => handleContext(args),
);

// ─── Tool 4: mindmap.parse ──────────────────────────────────────
server.registerTool(
  "mindmap.parse",
  {
    title: "Parse Source Files",
    description:
      "Parse source files using Tree-sitter at 3 depth levels: " +
      "summary, standard, detailed. Supports pagination. " +
      "Stores ParseResult in artifact store, returns artifactId + data.",
    inputSchema: {
      rootPath: z.string().describe("Absolute path to repository root"),
      files: z
        .array(
          z.object({
            fileId: z.string(),
            absolutePath: z.string(),
            canonicalPath: z.string(),
            language: z.string(),
          }),
        )
        .describe("Files to parse (from resolve output)"),
      depth: z
        .enum(["summary", "standard", "detailed"])
        .describe("Parse depth level"),
      options: z
        .object({
          maxSymbolsPerFile: z.number().optional().default(50),
          includeEvidence: z.boolean().optional().default(true),
          batchSize: z.number().optional().default(100),
          cursor: z.string().optional(),
          appendToArtifact: z.string().optional(),
        })
        .optional(),
    },
  },
  async (args) => handleParse(args, artifactStore),
);

// ─── Tool 5: mindmap.sample ────────────────────────────────────
server.registerTool(
  "mindmap.sample",
  {
    title: "Read Code Snippet",
    description:
      "Read a code snippet from a file by line range. " +
      "Used during interpretation when structural data is insufficient.",
    inputSchema: {
      rootPath: z.string().describe("Absolute path to repository root"),
      fileId: z.string().describe("File ID from resolve output"),
      absolutePath: z.string().describe("Absolute file path"),
      startLine: z.number().optional().default(1),
      endLine: z.number().optional().default(50),
      maxLines: z.number().optional().default(100),
    },
  },
  async (args) => handleSample(args),
);

// ─── Tool 6: mindmap.build ──────────────────────────────────────
server.registerTool(
  "mindmap.build",
  {
    title: "Build Mind Map",
    description:
      "Mechanically construct mind map graph from ArchitecturePlan + " +
      "parsed data. Reads ParseResult from artifact store. " +
      "Stores MindMapJSON in store. Returns artifactId + summary.",
    inputSchema: {
      plan: z.object({
        architecturePattern: z.string(),
        fileClassifications: z.array(z.object({
          fileId: z.string(),
          role: z.string(),
          confidence: z.number(),
          importance: z.enum(["core", "supporting", "peripheral"]).optional(),
        })),
        groups: z.array(z.object({
          label: z.string(),
          kind: z.enum(["layer", "domain", "feature", "infrastructure", "other"]),
          fileIds: z.array(z.string()),
          description: z.string().optional(),
        })),
        relationships: z.array(z.object({
          sourceFileId: z.string(),
          targetFileId: z.string(),
          rels: z.array(z.string()),
          annotation: z.string().optional(),
        })).optional(),
        presentationOptions: z.object({
          viewType: z.string().optional(),
          collapseRules: z.array(z.object({ pattern: z.string(), action: z.string() })).optional(),
        }).optional(),
      }).describe("ArchitecturePlan from the LLM"),
      parseArtifactId: z
        .string()
        .describe("Artifact store ID from mindmap.parse"),
      resolvedFiles: z.object({
        files: z.array(z.object({
          fileId: z.string(),
          canonicalPath: z.string(),
          language: z.string(),
          sizeBytes: z.number().optional(),
        })),
      }).describe("ResolvedFiles from mindmap.resolve"),
      policy: z
        .object({
          edgeAggregation: z.boolean().optional().default(true),
          maxDepth: z.number().optional(),
          collapseRules: z.array(z.object({ pattern: z.string(), action: z.string() })).optional(),
          includeSymbolNodes: z.boolean().optional().default(false),
          symbolNodeThreshold: z.number().optional(),
        })
        .optional(),
    },
  },
  async (args) => handleBuild(args, artifactStore),
);

// ─── Tool 7: mindmap.validate ───────────────────────────────────
server.registerTool(
  "mindmap.validate",
  {
    title: "Validate Mind Map",
    description:
      "Validate graph structural integrity: orphan nodes, broken edges, " +
      "cycles, duplicate IDs. Reads MindMapJSON from artifact store. " +
      "Returns full validation report.",
    inputSchema: {
      mindmapArtifactId: z
        .string()
        .describe("Artifact store ID from mindmap.build"),
    },
  },
  async (args) => handleValidate(args, artifactStore),
);

// ─── Tool 8: mindmap.publish ────────────────────────────────────
server.registerTool(
  "mindmap.publish",
  {
    title: "Publish Mind Map",
    description:
      "MANDATORY final step. Reads all artifacts from store, " +
      "bundles into final output, emits via structuredContent, " +
      "optionally writes to disk, clears artifact store.",
    inputSchema: {
      mindmapArtifactId: z
        .string()
        .describe("Artifact store ID from mindmap.build"),
      validationArtifactId: z
        .string()
        .optional()
        .describe("Artifact store ID from mindmap.validate"),
      options: z
        .object({
          writePath: z.string().optional().describe("File path to write MindMapJSON"),
          format: z.enum(["pretty", "compact"]).optional().default("pretty"),
        })
        .optional(),
    },
  },
  async (args) => handlePublish(args, artifactStore),
);

// ─── Tool 9: mindmap.overview ──────────────────────────────────
server.registerTool(
  "mindmap.overview",
  {
    title: "Mind Map Overview",
    description:
      "Read a previously generated mind map JSON from disk and return " +
      "an LLM-friendly project summary at 3 depth levels. " +
      "Use this to understand a project's architecture without reading the full graph.",
    inputSchema: {
      depth: z
        .enum(["minimal", "standard", "detailed"])
        .optional()
        .default("standard")
        .describe(
          "minimal: architecture + group names (~200 tokens). " +
          "standard: + core files, descriptions, key relationships (~800 tokens). " +
          "detailed: + all files, all edges, confidence scores (~2000 tokens).",
        ),
      focus: z
        .string()
        .optional()
        .describe("Filter to a specific group by name (e.g. 'API Layer')"),
    },
  },
  async (args) => handleOverview(args),
);

// ─── Start Server ───────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MindMap MCP Server v0.1.0 running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error starting MindMap MCP Server:", error);
  process.exit(1);
});
