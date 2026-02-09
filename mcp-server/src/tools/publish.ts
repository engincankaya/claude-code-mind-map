import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { type ArtifactStore } from "../lib/artifact-store.js";
import { type ToolResult, errorResult } from "../types.js";

interface PublishArgs {
  mindmapArtifactId: string;
  validationArtifactId?: string;
  options?: {
    writePath?: string;
    format?: "pretty" | "compact";
  };
}

export async function handlePublish(
  args: PublishArgs,
  store: ArtifactStore,
): Promise<ToolResult> {
  const { mindmapArtifactId, validationArtifactId, options = {} } = args;
  const { writePath, format = "pretty" } = options;

  try {
    const mindmap = store.getTyped<unknown>(mindmapArtifactId, "mindmapJSON");
    if (!mindmap) {
      return errorResult(`Mindmap artifact ${mindmapArtifactId} not found`);
    }

    // Optionally check validation passed
    if (validationArtifactId) {
      const validation = store.getTyped<{ isValid: boolean }>(validationArtifactId, "validationReport");
      if (validation && !validation.isValid) {
        return errorResult("Cannot publish: validation has errors. Fix issues and rebuild first.");
      }
    }

    const jsonStr = format === "pretty"
      ? JSON.stringify(mindmap, null, 2)
      : JSON.stringify(mindmap);

    // Write to file if requested
    if (writePath) {
      await mkdir(dirname(writePath), { recursive: true });
      await writeFile(writePath, jsonStr, "utf-8");
      console.error(`[Publish] Written to ${writePath}`);
    }

    // Return via structuredContent — the canonical output channel
    return {
      content: [
        { type: "text" as const, text: `Mind map published successfully (${jsonStr.length} bytes)${writePath ? ` → ${writePath}` : ""}` },
      ],
      structuredContent: mindmap as Record<string, unknown>,
    };
  } catch (err) {
    return errorResult(`publish failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
