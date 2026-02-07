import Parser from "web-tree-sitter";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Grammars directory relative to compiled dist/lib/tree-sitter-loader.js
const GRAMMARS_DIR = join(__dirname, "..", "grammars");

let initialized = false;
const languageCache = new Map<string, Parser.Language>();

/** Language name -> WASM filename mapping */
const GRAMMAR_FILES: Record<string, string> = {
  typescript: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  javascript: "tree-sitter-typescript.wasm",
  python: "tree-sitter-python.wasm",
  go: "tree-sitter-go.wasm",
  rust: "tree-sitter-rust.wasm",
  java: "tree-sitter-java.wasm",
};

/**
 * Initialize web-tree-sitter. Must be called once before any parsing.
 */
export async function initTreeSitter(): Promise<void> {
  if (!initialized) {
    await Parser.init();
    initialized = true;
    console.error("[TreeSitter] Initialized WASM runtime");
  }
}

/**
 * Load a language grammar. Caches loaded languages.
 */
export async function loadLanguage(
  language: string,
): Promise<Parser.Language | undefined> {
  if (languageCache.has(language)) {
    return languageCache.get(language);
  }

  const wasmFile = GRAMMAR_FILES[language];
  if (!wasmFile) {
    console.error(`[TreeSitter] No grammar for language: ${language}`);
    return undefined;
  }

  const wasmPath = join(GRAMMARS_DIR, wasmFile);
  try {
    const lang = await Parser.Language.load(wasmPath);
    languageCache.set(language, lang);
    console.error(`[TreeSitter] Loaded grammar: ${language}`);
    return lang;
  } catch (error) {
    console.error(`[TreeSitter] Failed to load ${wasmPath}:`, error);
    return undefined;
  }
}

/**
 * Create a parser configured for a specific language.
 */
export async function createParser(
  language: string,
): Promise<Parser | undefined> {
  await initTreeSitter();
  const lang = await loadLanguage(language);
  if (!lang) return undefined;

  const parser = new Parser();
  parser.setLanguage(lang);
  return parser;
}

/**
 * List all supported languages.
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(GRAMMAR_FILES);
}
