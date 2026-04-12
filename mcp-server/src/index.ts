import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ArtifactStore } from "./lib/artifact-store.js";
import { handleDiscover } from "./tools/discover.js";
import { handleGenerate } from "./tools/generate.js";
import { handleInspect } from "./tools/inspect.js";
import { handleOverview } from "./tools/overview.js";

const artifactStore = new ArtifactStore();

const server = new McpServer({
  name: "mindmap",
  version: "0.1.0",
});

server.registerTool(
  "mindmap.discover",
  {
    title: "Discover Repository",
    description:
      "Discover repository structure in one step: scan files, resolve paths and IDs, " +
      "and extract project context. Stores a discovery artifact for later inspect/generate steps.",
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
  async (args) => handleDiscover(args, artifactStore),
);

server.registerTool(
  "mindmap.inspect",
  {
    title: "Inspect Repository",
    description:
      "Inspect discovered files either by parsing source code or sampling code snippets. " +
      "Parse mode stores an inspection artifact for the generate step.",
    inputSchema: {
      discoveryArtifactId: z
        .string()
        .describe("Artifact ID returned by mindmap.discover"),
      mode: z
        .enum(["parse", "sample"])
        .describe("Whether to parse files structurally or read a code snippet"),
      depth: z
        .enum(["summary", "standard", "detailed"])
        .optional()
        .describe("Parse depth level for parse mode"),
      targets: z
        .object({
          fileIds: z
            .array(z.string())
            .optional()
            .describe("Specific discovered file IDs to inspect; omit to use all discovered files"),
        })
        .optional(),
      target: z
        .object({
          fileId: z.string(),
          startLine: z.number().optional(),
          endLine: z.number().optional(),
          maxLines: z.number().optional(),
        })
        .optional()
        .describe("Required for sample mode"),
      options: z
        .object({
          maxSymbolsPerFile: z.number().optional().default(50),
          includeEvidence: z.boolean().optional().default(true),
          batchSize: z.number().optional().default(100),
          cursor: z.string().optional(),
          appendToInspectionArtifactId: z.string().optional(),
        })
        .optional(),
    },
  },
  async (args) => handleInspect(args, artifactStore),
);

server.registerTool(
  "mindmap.generate",
  {
    title: "Generate Mind Map",
    description:
      "Generate the final mind map from a discovery artifact, a parse inspection artifact, " +
      "and the LLM's architecture plan. Builds, validates, and publishes in one step.",
    inputSchema: {
      discoveryArtifactId: z
        .string()
        .describe("Artifact ID returned by mindmap.discover"),
      inspectionArtifactId: z
        .string()
        .describe("Parse inspection artifact ID returned by mindmap.inspect"),
      plan: z.object({
        architecturePattern: z.string(),
        fileClassifications: z.array(z.object({
          fileId: z.string(),
          role: z.string(),
          confidence: z.number(),
          importance: z.enum(["core", "supporting", "peripheral"]).optional(),
          description: z.string().optional(),
        })),
        groups: z.array(z.object({
          label: z.string(),
          kind: z.enum(["layer", "domain", "feature", "infrastructure", "other"]),
          fileIds: z.array(z.string()),
          description: z.string().optional(),
          highlightFileIds: z.array(z.string()).optional(),
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
      options: z.object({
        validate: z.boolean().optional().default(true),
        writePath: z.string().optional(),
        format: z.enum(["pretty", "compact"]).optional().default("pretty"),
        edgeAggregation: z.boolean().optional().default(true),
      }).optional(),
    },
  },
  async (args) => handleGenerate(args, artifactStore),
);

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
          "standard: + key files, descriptions, key relationships (~800 tokens). " +
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

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MindMap MCP Server v0.1.0 running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error starting MindMap MCP Server:", error);
  process.exit(1);
});
