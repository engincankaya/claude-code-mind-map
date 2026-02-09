import { readFile, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import fg from "fast-glob";
import { type ToolResult, jsonResult, errorResult } from "../types.js";

const MAX_README_CHARS = 3000;

/** Package manager detection patterns */
const PACKAGE_MANAGERS: Array<{
  type: string;
  file: string;
  parser: (content: string) => { name?: string; dependencies?: string[]; scripts?: Record<string, string> };
}> = [
  {
    type: "npm",
    file: "package.json",
    parser: (content) => {
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const deps = [
        ...Object.keys((pkg.dependencies as Record<string, string>) ?? {}),
        ...Object.keys((pkg.devDependencies as Record<string, string>) ?? {}),
      ];
      return {
        name: pkg.name as string | undefined,
        dependencies: deps,
        scripts: pkg.scripts as Record<string, string> | undefined,
      };
    },
  },
  {
    type: "cargo",
    file: "Cargo.toml",
    parser: (content) => {
      const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
      const deps = [...content.matchAll(/^\[dependencies\.(\w+)\]/gm)].map(
        (m) => m[1],
      );
      const inlineDeps = [
        ...content.matchAll(/^(\w[\w-]*)\s*=\s*(?:"|{)/gm),
      ]
        .map((m) => m[1])
        .filter((d) => !["name", "version", "edition", "authors", "description", "license", "repository"].includes(d));
      return {
        name: nameMatch?.[1],
        dependencies: [...new Set([...deps, ...inlineDeps])],
      };
    },
  },
  {
    type: "go",
    file: "go.mod",
    parser: (content) => {
      const nameMatch = content.match(/^module\s+(.+)$/m);
      const deps = [...content.matchAll(/^\s+(\S+)\s+v/gm)].map((m) => m[1]);
      return { name: nameMatch?.[1], dependencies: deps };
    },
  },
  {
    type: "pip",
    file: "requirements.txt",
    parser: (content) => {
      const deps = content
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split(/[>=<!\[;]/)[0].trim())
        .filter(Boolean);
      return { dependencies: deps };
    },
  },
  {
    type: "pip",
    file: "pyproject.toml",
    parser: (content) => {
      const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
      return { name: nameMatch?.[1] };
    },
  },
  {
    type: "maven",
    file: "pom.xml",
    parser: (_content) => {
      return {};
    },
  },
  {
    type: "gradle",
    file: "build.gradle",
    parser: (_content) => {
      return {};
    },
  },
  {
    type: "gradle",
    file: "build.gradle.kts",
    parser: (_content) => {
      return {};
    },
  },
  {
    type: "composer",
    file: "composer.json",
    parser: (content) => {
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const deps = Object.keys(
        (pkg.require as Record<string, string>) ?? {},
      );
      return { name: pkg.name as string | undefined, dependencies: deps };
    },
  },
  {
    type: "gem",
    file: "Gemfile",
    parser: (content) => {
      const deps = [...content.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)].map(
        (m) => m[1],
      );
      return { dependencies: deps };
    },
  },
  {
    type: "mix",
    file: "mix.exs",
    parser: (_content) => {
      return {};
    },
  },
  {
    type: "nuget",
    file: "*.csproj",
    parser: (_content) => {
      return {};
    },
  },
];

/** Config file detection */
const CONFIG_PATTERNS: Array<{ glob: string; type: string; summary: string }> =
  [
    { glob: "tsconfig*.json", type: "tsconfig", summary: "TypeScript config" },
    {
      glob: ".eslintrc*",
      type: "eslint",
      summary: "ESLint linting config",
    },
    {
      glob: "eslint.config.*",
      type: "eslint",
      summary: "ESLint flat config",
    },
    {
      glob: ".prettierrc*",
      type: "prettier",
      summary: "Prettier formatting config",
    },
    {
      glob: "prettier.config.*",
      type: "prettier",
      summary: "Prettier formatting config",
    },
    {
      glob: "Dockerfile*",
      type: "docker",
      summary: "Docker container config",
    },
    {
      glob: "docker-compose*.{yml,yaml}",
      type: "docker",
      summary: "Docker Compose multi-container config",
    },
    {
      glob: ".github/workflows/*.{yml,yaml}",
      type: "ci",
      summary: "GitHub Actions CI/CD",
    },
    {
      glob: ".gitlab-ci.yml",
      type: "ci",
      summary: "GitLab CI/CD config",
    },
    { glob: "Jenkinsfile", type: "ci", summary: "Jenkins CI pipeline" },
    {
      glob: ".env.example",
      type: "other",
      summary: "Environment variable template",
    },
    {
      glob: "vitest.config.*",
      type: "other",
      summary: "Vitest test config",
    },
    { glob: "jest.config.*", type: "other", summary: "Jest test config" },
    { glob: "webpack.config.*", type: "other", summary: "Webpack bundler config" },
    { glob: "vite.config.*", type: "other", summary: "Vite build config" },
    { glob: "next.config.*", type: "other", summary: "Next.js framework config" },
    { glob: "nuxt.config.*", type: "other", summary: "Nuxt framework config" },
    { glob: "nest-cli.json", type: "other", summary: "NestJS CLI config" },
  ];

/** Entry point detection patterns */
const ENTRY_PATTERNS = [
  "src/index.{ts,tsx,js,jsx}",
  "src/main.{ts,tsx,js,jsx,py,go,rs,java}",
  "src/app.{ts,tsx,js,jsx,py}",
  "src/server.{ts,tsx,js,jsx}",
  "index.{ts,tsx,js,jsx}",
  "main.{ts,tsx,js,jsx,py,go,rs}",
  "app.{ts,tsx,js,jsx,py}",
  "cmd/*/main.go",
  "src/lib.rs",
  "src/main.rs",
  "manage.py",
  "app/main.py",
];

interface ContextArgs {
  rootPath: string;
}

async function tryReadFile(
  filePath: string,
  maxChars?: number,
): Promise<string | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    return maxChars ? content.slice(0, maxChars) : content;
  } catch {
    return undefined;
  }
}

async function getFolderStructure(
  rootPath: string,
): Promise<{ topLevelDirs: string[]; maxDepth: number; totalDirs: number }> {
  const topEntries = await readdir(rootPath, { withFileTypes: true });
  const topLevelDirs = topEntries
    .filter(
      (e) =>
        e.isDirectory() &&
        !e.name.startsWith(".") &&
        e.name !== "node_modules" &&
        e.name !== "__pycache__" &&
        e.name !== "dist" &&
        e.name !== "build",
    )
    .map((e) => e.name)
    .sort();

  // Count directories for depth estimation
  const allDirs = await fg("**", {
    cwd: rootPath,
    onlyDirectories: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/__pycache__/**",
      "**/.venv/**",
      "**/vendor/**",
      "**/target/**",
    ],
    deep: 10,
    suppressErrors: true,
  });

  let maxDepth = 0;
  for (const d of allDirs) {
    const depth = d.split("/").length;
    if (depth > maxDepth) maxDepth = depth;
  }

  return { topLevelDirs, maxDepth, totalDirs: allDirs.length };
}

async function getLanguageStats(
  rootPath: string,
): Promise<Array<{ language: string; fileCount: number; percentage: number }>> {
  const files = await fg("**/*", {
    cwd: rootPath,
    onlyFiles: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/build/**",
      "**/__pycache__/**",
      "**/.venv/**",
      "**/vendor/**",
      "**/target/**",
    ],
    suppressErrors: true,
  });

  const counts = new Map<string, number>();
  for (const f of files) {
    const ext = extname(f).toLowerCase();
    // Only count source code files
    const sourceExts = [
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".go", ".rs",
      ".java", ".kt", ".swift", ".c", ".cpp", ".cc", ".h", ".hpp",
      ".cs", ".rb", ".php", ".ex", ".exs", ".vue", ".svelte",
    ];
    if (sourceExts.includes(ext)) {
      const lang = ext.replace(".", "");
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .map(([language, fileCount]) => ({
      language,
      fileCount,
      percentage: total > 0 ? Math.round((fileCount / total) * 100) : 0,
    }))
    .sort((a, b) => b.fileCount - a.fileCount);
}

export async function handleContext(args: ContextArgs): Promise<ToolResult> {
  const { rootPath } = args;

  try {
    // README
    const readmeNames = [
      "README.md",
      "readme.md",
      "README.rst",
      "README.txt",
      "README",
    ];
    let readme: string | undefined;
    for (const name of readmeNames) {
      readme = await tryReadFile(join(rootPath, name), MAX_README_CHARS);
      if (readme) break;
    }

    // Package managers
    const packageManagers: Array<{
      type: string;
      filePath: string;
      name?: string;
      dependencies?: string[];
      scripts?: Record<string, string>;
    }> = [];

    for (const pm of PACKAGE_MANAGERS) {
      if (pm.file.includes("*")) {
        const matches = await fg(pm.file, {
          cwd: rootPath,
          suppressErrors: true,
        });
        for (const m of matches) {
          const content = await tryReadFile(join(rootPath, m));
          if (content) {
            try {
              const parsed = pm.parser(content);
              packageManagers.push({ type: pm.type, filePath: m, ...parsed });
            } catch {
              packageManagers.push({ type: pm.type, filePath: m });
            }
          }
        }
      } else {
        const content = await tryReadFile(join(rootPath, pm.file));
        if (content) {
          try {
            const parsed = pm.parser(content);
            packageManagers.push({
              type: pm.type,
              filePath: pm.file,
              ...parsed,
            });
          } catch {
            packageManagers.push({ type: pm.type, filePath: pm.file });
          }
        }
      }
    }

    // Configs
    const configs: Array<{
      filePath: string;
      type: string;
      summary: string;
    }> = [];
    for (const cp of CONFIG_PATTERNS) {
      const matches = await fg(cp.glob, {
        cwd: rootPath,
        suppressErrors: true,
      });
      for (const m of matches) {
        configs.push({ filePath: m, type: cp.type, summary: cp.summary });
      }
    }

    // Entry points
    const entryPoints: string[] = [];
    for (const pattern of ENTRY_PATTERNS) {
      const matches = await fg(pattern, {
        cwd: rootPath,
        suppressErrors: true,
      });
      entryPoints.push(...matches);
    }

    // Folder structure
    const folderStructure = await getFolderStructure(rootPath);

    // Language stats
    const primaryLanguages = await getLanguageStats(rootPath);

    // Total file count + size
    const allFiles = await fg("**/*", {
      cwd: rootPath,
      onlyFiles: true,
      ignore: ["**/node_modules/**", "**/.git/**"],
      suppressErrors: true,
    });

    let totalSizeBytes = 0;
    for (const f of allFiles) {
      try {
        const s = await stat(join(rootPath, f));
        totalSizeBytes += s.size;
      } catch {
        // skip
      }
    }

    return jsonResult({
      rootPath,
      projectFiles: {
        readme,
        packageManagers,
        configs,
        entryPoints: [...new Set(entryPoints)].sort(),
      },
      folderStructure,
      repoMeta: {
        primaryLanguages,
        totalFiles: allFiles.length,
        totalSizeBytes,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`context failed: ${message}`);
  }
}
