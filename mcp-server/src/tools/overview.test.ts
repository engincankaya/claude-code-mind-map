import { readFile } from "fs/promises";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { parseJsonToolResult } from "../types.js";
import { buildOverview, type MindMapJSON, handleOverview } from "./overview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(__dirname, "../../..", "mindmap-output.json");

async function loadFixture(): Promise<MindMapJSON> {
  return JSON.parse(await readFile(fixturePath, "utf-8")) as MindMapJSON;
}

describe("mindmap.overview", () => {
  it("returns a minimal project-level summary with all groups", async () => {
    const mindmap = await loadFixture();
    const result = buildOverview(mindmap, "minimal");

    expect(result.stats.groups).toBeGreaterThan(0);
    expect(result.groups.length).toBe(result.stats.groups);
    expect(result.groups.some((group) => group.name === "Public MCP Tools")).toBe(true);
  });

  it("returns standard key files and relationships without a focus field", async () => {
    const result = parseJsonToolResult<{
      focus?: unknown;
      groups: Array<{ name: string; keyFiles: Array<{ path: string }> }>;
      keyRelationships: unknown[];
    }>(await handleOverview({ depth: "standard" }));

    expect(result.focus).toBeUndefined();
    expect(result.groups.some((group) => group.name === "Public MCP Tools")).toBe(true);
    expect(
      result.groups.some((group) =>
        group.keyFiles.some((file) => file.path === "mcp-server/src/tools/discover.ts"),
      ),
    ).toBe(true);
    expect(Array.isArray(result.keyRelationships)).toBe(true);
  });
});
