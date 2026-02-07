/**
 * MCP tool handler return type.
 * Must include index signature for compatibility with CallToolResult.
 */
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
}

/**
 * Helper to create a tool result with JSON text content.
 */
export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Helper to create an error tool result.
 */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  };
}
