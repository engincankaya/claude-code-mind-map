import { readFile } from "node:fs/promises";
import { type ArtifactStore } from "../lib/artifact-store.js";
import { createParser, getSupportedLanguages } from "../lib/tree-sitter-loader.js";
import { symbolId as makeSymbolId } from "../lib/hashing.js";
import { getNormalizer } from "../languages/registry.js";
import type { NormalizerResult, SymbolInfo } from "../languages/types.js";
import { type ToolResult, jsonResult, errorResult } from "../types.js";

interface ParseFileInput {
  fileId: string;
  absolutePath: string;
  canonicalPath: string;
  language: string;
}

interface ParseArgs {
  rootPath: string;
  files: ParseFileInput[];
  depth: "summary" | "standard" | "detailed";
  options?: {
    maxSymbolsPerFile?: number;
    includeEvidence?: boolean;
    batchSize?: number;
    cursor?: string;
    appendToArtifact?: string;
  };
}

interface ParseResult {
  files: unknown[];
  unresolvedImports: Array<{ fromFileId: string; rawSpecifier: string }>;
  parserMeta: {
    treeSitterVersion: string;
    languagesUsed: string[];
    parseErrors: Array<{ fileId: string; error: string }>;
  };
}

function toSummary(input: ParseFileInput, result: NormalizerResult, lineCount: number) {
  const symbolKinds: Record<string, number> = {};
  for (const sym of result.symbols) {
    symbolKinds[sym.kind] = (symbolKinds[sym.kind] ?? 0) + 1;
  }
  return {
    fileId: input.fileId,
    canonicalPath: input.canonicalPath,
    language: input.language,
    stats: {
      lines: lineCount,
      importCount: result.imports.length,
      exportCount: result.exports.length,
      symbolCount: result.symbols.length,
      symbolKinds,
    },
  };
}

function toStandard(input: ParseFileInput, result: NormalizerResult, maxSymbols: number) {
  return {
    fileId: input.fileId,
    canonicalPath: input.canonicalPath,
    language: input.language,
    imports: result.imports.map((i) => ({
      rawSpecifier: i.rawSpecifier,
      kind: i.kind,
      importedSymbols: i.importedSymbols,
    })),
    exports: result.exports.map((e) => ({
      kind: e.kind,
      exportedSymbols: e.exportedSymbols,
    })),
    symbols: result.symbols.slice(0, maxSymbols).map((s) => ({
      symbolId: makeSymbolId(input.fileId, s.kind, s.name),
      kind: s.kind,
      name: s.name,
      visibility: s.visibility,
      evidence: { startLine: s.startLine, endLine: s.endLine },
    })),
  };
}

function toDetailed(input: ParseFileInput, result: NormalizerResult, maxSymbols: number) {
  return {
    fileId: input.fileId,
    canonicalPath: input.canonicalPath,
    language: input.language,
    imports: result.imports.map((i) => ({
      rawSpecifier: i.rawSpecifier,
      kind: i.kind,
      importedSymbols: i.importedSymbols,
    })),
    exports: result.exports.map((e) => ({
      kind: e.kind,
      exportedSymbols: e.exportedSymbols,
      fromSpecifier: e.fromSpecifier,
    })),
    symbols: result.symbols.slice(0, maxSymbols).map((s: SymbolInfo) => ({
      symbolId: makeSymbolId(input.fileId, s.kind, s.name),
      kind: s.kind,
      name: s.name,
      visibility: s.visibility,
      evidence: { startLine: s.startLine, endLine: s.endLine },
      signature: s.signature,
      decorators: s.decorators,
      typeAnnotations: s.typeAnnotations,
      docComment: s.docComment,
    })),
    reExports: result.exports
      .filter((e) => e.kind === "re-export" && e.fromSpecifier)
      .map((e) => ({ fromSpecifier: e.fromSpecifier!, symbols: e.exportedSymbols })),
  };
}

export async function handleParse(
  args: ParseArgs,
  store: ArtifactStore,
): Promise<ToolResult> {
  const {
    files,
    depth,
    options: {
      maxSymbolsPerFile = 50,
      batchSize = 100,
      cursor,
      appendToArtifact,
    } = {},
  } = args;

  try {
    const startIdx = cursor ? parseInt(cursor, 10) : 0;
    if (isNaN(startIdx) || startIdx < 0) {
      return errorResult("Invalid pagination cursor");
    }

    const batch = files.slice(startIdx, startIdx + batchSize);
    const hasMore = startIdx + batchSize < files.length;
    const nextCursor = hasMore ? String(startIdx + batchSize) : undefined;

    const parsedFiles: unknown[] = [];
    const unresolvedImports: Array<{ fromFileId: string; rawSpecifier: string }> = [];
    const languagesUsed = new Set<string>();
    const parseErrors: Array<{ fileId: string; error: string }> = [];
    const supported = getSupportedLanguages();

    for (const file of batch) {
      if (!supported.includes(file.language)) {
        parseErrors.push({ fileId: file.fileId, error: `Unsupported language: ${file.language}` });
        continue;
      }

      try {
        const source = await readFile(file.absolutePath, "utf-8");
        const lineCount = source.split("\n").length;
        const parser = await createParser(file.language);
        if (!parser) {
          parseErrors.push({ fileId: file.fileId, error: `Failed to create parser for ${file.language}` });
          continue;
        }

        const tree = parser.parse(source);
        const normalizer = getNormalizer(file.language);
        if (!normalizer) {
          parseErrors.push({ fileId: file.fileId, error: `No normalizer for ${file.language}` });
          continue;
        }

        const result = normalizer.normalize(tree, source);
        languagesUsed.add(file.language);

        // External imports (not relative)
        for (const imp of result.imports) {
          if (!imp.rawSpecifier.startsWith(".") && !imp.rawSpecifier.startsWith("/")) {
            unresolvedImports.push({ fromFileId: file.fileId, rawSpecifier: imp.rawSpecifier });
          }
        }

        switch (depth) {
          case "summary":
            parsedFiles.push(toSummary(file, result, lineCount));
            break;
          case "standard":
            parsedFiles.push(toStandard(file, result, maxSymbolsPerFile));
            break;
          case "detailed":
            parsedFiles.push(toDetailed(file, result, maxSymbolsPerFile));
            break;
        }
      } catch (err) {
        parseErrors.push({ fileId: file.fileId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const parseResult: ParseResult = {
      files: parsedFiles,
      unresolvedImports,
      parserMeta: {
        treeSitterVersion: "0.24",
        languagesUsed: [...languagesUsed],
        parseErrors,
      },
    };

    // Artifact store: append or create
    let artifactId: string;
    if (appendToArtifact) {
      const existing = store.getTyped<ParseResult>(appendToArtifact, "parseResult");
      if (!existing) return errorResult(`Artifact ${appendToArtifact} not found or wrong type`);
      existing.files.push(...parsedFiles);
      existing.unresolvedImports.push(...unresolvedImports);
      existing.parserMeta.parseErrors.push(...parseErrors);
      for (const lang of languagesUsed) {
        if (!existing.parserMeta.languagesUsed.includes(lang)) {
          existing.parserMeta.languagesUsed.push(lang);
        }
      }
      store.delete(appendToArtifact);
      artifactId = store.put("parseResult", existing, `ParseResult: ${existing.files.length} files`);
    } else {
      artifactId = store.put("parseResult", parseResult, `ParseResult: ${parsedFiles.length} files, depth=${depth}`);
    }

    return jsonResult({
      artifactId,
      files: parsedFiles,
      unresolvedImports,
      pagination: { cursor: nextCursor, hasMore, processedCount: startIdx + batch.length, totalCount: files.length },
      parserMeta: parseResult.parserMeta,
    });
  } catch (err) {
    return errorResult(`parse failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
