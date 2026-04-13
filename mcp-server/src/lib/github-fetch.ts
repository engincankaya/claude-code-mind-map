/**
 * Fetches a file's raw contents from a GitHub repository via the
 * `/repos/{owner}/{repo}/contents/{path}` REST endpoint. Works for both
 * public and private repos — auth is sent only when GITHUB_PAT is set.
 */

const GITHUB_API = "https://api.github.com";

export interface GithubFetchOptions {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export function parseRepoId(repoId: string): { owner: string; repo: string } {
  const trimmed = repoId.trim();
  const match = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match) {
    throw new Error(
      `Invalid selected_repo_id "${repoId}" — expected "owner/repo" format`,
    );
  }
  return { owner: match[1], repo: match[2] };
}

export async function fetchGithubFileRaw(
  opts: GithubFetchOptions,
): Promise<string> {
  const { owner, repo, path, ref } = opts;
  const url =
    `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` +
    `/contents/${path.split("/").map(encodeURIComponent).join("/")}` +
    (ref ? `?ref=${encodeURIComponent(ref)}` : "");

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw",
    "User-Agent": "mindmap-mcp-server",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = process.env.GITHUB_PAT;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GitHub fetch failed (${res.status} ${res.statusText}) for ${owner}/${repo}/${path}` +
        (body ? `: ${body.slice(0, 200)}` : ""),
    );
  }

  return await res.text();
}
