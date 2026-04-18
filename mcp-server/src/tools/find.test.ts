import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { parseJsonToolResult } from "../types.js";
import { buildFind, handleFind } from "./find.js";
import { type MindMapJSON } from "./overview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../../..", "mindmap-output.json");

interface FindResult {
  query: {
    matched: boolean;
    strategy: "direct" | "token" | "no-match";
    matchedGroups: string[];
    matchedFiles: string[];
    suggestions: string[];
  };
  groups: Array<{
    name: string;
    files?: Array<{ path: string; confidence: number }>;
  }>;
  keyRelationships?: unknown[];
  edges?: unknown[];
}

async function loadFixture(): Promise<MindMapJSON> {
  return JSON.parse(await readFile(fixturePath, "utf-8")) as MindMapJSON;
}

describe("mindmap.find", () => {
  it("finds a direct group query", async () => {
    const mindmap = await loadFixture();
    const result = buildFind(mindmap, "Public MCP Tools", "standard") as FindResult;

    expect(result.query.matched).toBe(true);
    expect(result.query.strategy).toBe("direct");
    expect(result.query.matchedGroups).toContain("Public MCP Tools");
    expect(result.groups.map((group) => group.name)).toContain("Public MCP Tools");
  });

  it("finds matches from file path or role metadata", async () => {
    const mindmap = await loadFixture();
    const result = buildFind(mindmap, "tool-overview", "standard") as FindResult;

    expect(result.query.matched).toBe(true);
    expect(result.query.matchedFiles).toContain("mcp-server/src/tools/overview.ts");
    expect(result.groups.map((group) => group.name)).toContain("Public MCP Tools");
  });

  it("uses token matching for feature-like queries that are not exact group names", async () => {
    const result = parseJsonToolResult<FindResult>(
      await handleFind({ query: "RAG Pipeline", depth: "standard" }),
    );

    expect(result.query.matched).toBe(true);
    expect(result.query.strategy).toBe("token");
    expect(result.query.matchedGroups.length).toBeGreaterThan(0);
    expect(result.groups.length).toBeGreaterThan(0);
  });

  it("returns suggestions and full groups on no match", async () => {
    const result = parseJsonToolResult<FindResult>(
      await handleFind({ query: "zzzz nonexistent area", depth: "standard" }),
    );

    expect(result.query.matched).toBe(false);
    expect(result.query.strategy).toBe("no-match");
    expect(result.query.suggestions).toContain("Public MCP Tools");
    expect(result.groups.length).toBeGreaterThan(result.query.suggestions.length);
  });

  it("includes confidence scores and related edges in detailed depth", async () => {
    const mindmap = await loadFixture();
    const result = buildFind(mindmap, "Public MCP Tools", "detailed") as FindResult;

    expect(result.edges).toBeDefined();
    expect(result.groups.some((group) =>
      group.files?.some((file) =>
        file.path === "mcp-server/src/tools/overview.ts"
          && typeof file.confidence === "number",
      ),
    )).toBe(true);
  });
});
