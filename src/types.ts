// Common types and interfaces for MCP implementation in TypeScript

/**
 * Represents the structure for defining arguments for a tool.
 * This is often a JSON Schema definition.
 */
export interface ToolArguments {
  [key: string]: any; // Using a simple structure for now, could be more specific (e.g., JSON Schema)
}

/**
 * Represents a tool available in the MCP implementation.
 */
// export interface Tool {
//   name: string;
//   description: string;
//   arguments: ToolArguments;
//   [key: string]: any; // Allow additional properties
// }

/**
 * Base interface for tool call result content
 */
export interface BaseContent {
  type: string;
  [key: string]: any;
}

/**
 * Text content in tool call result
 */
export interface TextContent extends BaseContent {
  type: 'text';
  text: string;
}

/**
 * Image content in tool call result
 */
export interface ImageContent extends BaseContent {
  type: 'image';
  data: string; // Base64 encoded image data
  format?: string; // Optional image format (e.g., 'png', 'jpeg')
}

/**
 * Embedded resource in tool call result
 */
export interface EmbeddedResource extends BaseContent {
  type: 'resource';
  text?: string;
  blob?: Buffer | string;
  format?: string;
}

/**
 * Represents the result of calling a tool.
 */
export interface CallToolResult {
  isError: boolean;
  content: (TextContent | ImageContent | EmbeddedResource)[];
}

/**
 * Server configuration interface
 */
export interface ServerConfig {
  type: string;
  [key: string]: any;
}

/**
 * Client configuration interface
 */
export interface MCPClientConfig {
  mcpServers: Record<string, ServerConfig>;
  [key: string]: any;
}