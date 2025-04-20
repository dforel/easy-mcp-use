// LangChain adapter for MCP tools in TypeScript
// Note: This requires installing langchain: npm install langchain
// For JSON schema validation/conversion, consider libraries like zod or ajv.

import { StructuredTool, ToolRunnableConfig } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { z } from 'zod'; // Using Zod for schema validation/generation
import { BaseConnector } from '../connectors/base'; // Assuming BaseConnector is defined
import {  CallToolResult, TextContent, ImageContent, EmbeddedResource } from '../types'; // Assuming types are defined
import { logger } from '../logging'; // Assuming logger is defined
import { Tool } from '@modelcontextprotocol/sdk/types';
import { convertJsonSchemaZodToLangChain, getZodSchemaString, jsonSchemaToZod } from '../utils/json2zod';

// Helper function to parse MCP tool result content
function parseMcpToolResult(toolResult: CallToolResult): string {
  if (toolResult.isError) {
    throw new Error(`Tool execution failed: ${toolResult.content}`);
  }

  if (!toolResult.content || toolResult.content.length === 0) {
    // Langchain tools expect a string return, even if empty
    logger.warn('Tool execution returned no content');
    return '';
    // throw new ToolException('Tool execution returned no content');
  }

  let decodedResult = '';
  for (const item of toolResult.content) {
    switch (item.type) {
      case 'text':
        decodedResult += (item as TextContent).text;
        break;
      case 'image':
        // Decide how to represent image data (e.g., base64 string, placeholder)
        decodedResult += `[Image Data: ${(item as ImageContent).data.substring(0, 50)}...]`;
        break;
      case 'resource':
        const resource = (item as any).resource as EmbeddedResource; // Cast needed based on actual type
        if (resource.text) {
          decodedResult += resource.text;
        } else if (resource.blob) {
          // Handle blob data (e.g., decode if Buffer, stringify otherwise)
          decodedResult += Buffer.isBuffer(resource.blob)
            ? `[Blob Data: ${resource.blob.toString('utf-8', 0, 50)}...]` // Example: decode first 50 bytes as utf-8
            : `[Blob Data: ${JSON.stringify(resource.blob).substring(0, 50)}...]`;
        } else {
          logger.warn(`Unexpected resource type within content: ${resource.type}`);
          decodedResult += `[Unsupported Resource: ${resource.type}]`;
        }
        break;
      default:
        logger.warn(`Unexpected content type: ${item}`);
        decodedResult += `[Unsupported Content: ${item}]`;
    }
  }

  return decodedResult;
}


export class LangChainAdapter {
  private disallowedTools: string[];
  private connectorToolMap: Map<BaseConnector, StructuredTool[]> = new Map();

  constructor(disallowedTools: string[] = []) {
    this.disallowedTools = disallowedTools;
  }

  // fixSchema equivalent is handled within jsonSchemaToZod or by the chosen library

  async loadToolsForConnector(connector: BaseConnector): Promise<StructuredTool[]> {
    if (this.connectorToolMap.has(connector)) {
      const existingTools = this.connectorToolMap.get(connector)!;
      logger.debug(`Returning ${existingTools.length} existing tools for connector`);
      return existingTools;
    }

    const connectorTools: StructuredTool[] = [];

    // Ensure connector is initialized and has tools
    // Assuming connector.tools is populated after initialization
    // The Python version checks hasattr and initializes if needed.
    // We'll assume the connector is ready or MCPSession handles initialization.
    let mcpTools: Tool[] = [];
    try { 
      if (connector.getTools()) {
          mcpTools = connector.getTools();
      } else {
          logger.warn('Connector does not have tools array populated. Attempting to discover via session.'); 
      }

    } catch (error) {
      logger.error(`Error accessing or initializing tools for connector: ${error}`);
      return []; // Return empty list if tools cannot be loaded
    }

    if (!mcpTools || mcpTools.length === 0) {
        logger.warn('No MCP tools found or loaded for the connector.');
        return [];
    }

    for (const tool of mcpTools) {
      if (this.disallowedTools.includes(tool.name)) {
        continue;
      }

      // Dynamically create a class for each tool
      class McpToLangChainAdapterTool extends StructuredTool {
        // Define properties required by BaseTool
        name: string = tool.name || 'NO_NAME';
        description: string = tool.description || '';
        // Use Zod for schema definition and validation
        
        schema = convertJsonSchemaZodToLangChain(jsonSchemaToZod(tool.inputSchema)); // Convert JSON schema 

        // Store connector instance
        private toolConnector: BaseConnector = connector;

        constructor() {
            super();
            logger.info(`MCP tool: "${this.name}" arguments:`, tool.inputSchema);
            // logger.info(JSON.stringify(tool) );
            // logger.info(JSON.stringify( jsonSchemaToZod(tool.inputSchema) ) );
            this.schema = convertJsonSchemaZodToLangChain(jsonSchemaToZod(tool.inputSchema)); // Convert JSON schema
            logger.info(`this.schema `, JSON.stringify( getZodSchemaString(this.schema)  ) );

            // Langchain checks for schema, name, description upon instantiation
        }

        // Implement the _call method for LangChain
        async _call(arg: any, runManager?: CallbackManagerForToolRun, parentConfig?: ToolRunnableConfig): Promise<string> {
          logger.debug(`MCP tool: "${this.name}" received input:`, arg);

          try {
            // Assuming connector has a method like callTool or send
            // Adjust based on BaseConnector interface
            const toolResult: CallToolResult = await this.toolConnector.callTool(
              this.name,
              arg
            );
            logger.debug("CP tool get result :",JSON.stringify(toolResult))
            try {
              return parseMcpToolResult(toolResult);
            } catch (parseError: any) {
              logger.error(`Error parsing tool result for ${this.name}: ${parseError}`);
              // Return error details and raw content if parsing fails
              const rawContent = JSON.stringify(toolResult.content).substring(0, 100);
              return `Error parsing result: ${parseError.message}; Raw content snippet: ${rawContent}...`;
            }
          } catch (error: any) {
            logger.error(`Error executing MCP tool ${this.name}: ${error}`);
            // Langchain expects a string return on error as well
            // if (this.handle_tool_error) { // BaseTool doesn't have handle_tool_error directly
            //   return `Error executing MCP tool: ${error.message}`;
            // }
            // Throwing ToolException is often preferred
            throw new Error(`Error executing MCP tool ${this.name}: ${error.message}`);
          }
        }
      }

      connectorTools.push(new McpToLangChainAdapterTool());
    }

    this.connectorToolMap.set(connector, connectorTools);
    logger.debug(
      `Loaded ${connectorTools.length} new tools for connector: ${connectorTools.map(t => t.name).join(', ')}`
    );

    return connectorTools;
  }

  async createLangchainTools(connectors: BaseConnector[]): Promise<StructuredTool[]> {
    let allTools: StructuredTool[] = [];
    for (const connector of connectors) {
      try {
        const tools = await this.loadToolsForConnector(connector);
        allTools = allTools.concat(tools);
      } catch (error) {
        logger.error(`Failed to load tools for one of the connectors: ${error}`);
        // Continue loading tools from other connectors
      }
    }
    logger.info(`Total LangChain tools created: ${allTools.length}`);
    return allTools;
  }
}