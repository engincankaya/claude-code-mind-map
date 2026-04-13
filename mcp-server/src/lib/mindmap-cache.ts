import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.resolve(__dirname, "../../.cache");

function sanitize(repoId: string): string {
  return repoId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function cachePathFor(repoId: string): string {
  return path.join(CACHE_DIR, `${sanitize(repoId)}.json`);
}

export async function readCache(repoId: string): Promise<string | null> {
  try {
    return await fs.readFile(cachePathFor(repoId), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeCache(repoId: string, content: string): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(cachePathFor(repoId), content, "utf-8");
}
