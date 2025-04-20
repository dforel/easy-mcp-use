// Manages MCP servers and provides tools for server selection and management in TypeScript

import { DynamicTool , StructuredTool } from '@langchain/core/tools';
import { z } from 'zod'; // Using Zod for input schema validation
import { MCPClient } from '../client'; // Assuming MCPClient is defined
import { logger } from '../logging'; // Assuming logger is defined
import { LangChainAdapter } from '../adapters/langchain_adapter'; // Assuming LangChainAdapter is defined
import { MCPSession } from '../session'; // Assuming MCPSession is defined

// Define Zod schemas for tool inputs, mirroring Pydantic models
const ServerActionInputSchema = z.object({
  server_name: z.string().describe('The name of the MCP server'),
});

const DisconnectServerInputSchema = z.object({}); // No arguments

const ListServersInputSchema = z.object({}); // No arguments

const CurrentServerInputSchema = z.object({}); // No arguments

export class ServerManager {
  private client: MCPClient;
  private adapter: LangChainAdapter;
  private activeServer: string | null = null;
  private initializedServers: Record<string, boolean> = {};
  private serverToolsCache: Record<string, StructuredTool[]> = {}; // Cache for tools per server

  constructor(client: MCPClient, adapter: LangChainAdapter) {
    this.client = client;
    this.adapter = adapter;
  }

  async initialize(): Promise<void> {
    // Check for server configurations
    if (this.client.getServerNames().length === 0) {
      logger.warn('No MCP servers defined in client configuration');
    }
    logger.info('ServerManager initialized.');
  }

  async getServerManagementTools(): Promise<any[]> {
    logger.debug('Getting server management tools...');

    const listServersTool = new DynamicTool({
      name: 'list_mcp_servers',
      description: 'Lists all available MCP (Model Context Protocol) servers that can be connected to, along with the tools available on each server. Use this tool to discover servers and see what functionalities they offer.',
      // schema: ListServersInputSchema,
      func: async (_input: z.infer<typeof ListServersInputSchema>) => this.listServers(),
    });

    const connectServerTool = new DynamicTool({
      name: 'connect_to_mcp_server',
      description: 'Connect to a specific MCP (Model Context Protocol) server to use its tools. Use this tool to switch the active server.',
      // schema: ServerActionInputSchema,
      func: async (input: string) => {
        // 将输入字符串解析为预期的对象格式
        const parsedInput = JSON.parse(input);
        const validatedInput = ServerActionInputSchema.parse(parsedInput);
        return this.connectToServer(validatedInput.server_name);
      },
    });

    const getActiveServerTool = new DynamicTool({
      name: 'get_active_mcp_server',
      description: 'Get the currently active MCP (Model Context Protocol) server.',
      // schema: CurrentServerInputSchema,
      func: async (_input: z.infer<typeof CurrentServerInputSchema>) => this.getActiveServer(),
    });

    const disconnectServerTool = new DynamicTool({
      name: 'disconnect_from_mcp_server',
      description: 'Disconnect from the currently active MCP (Model Context Protocol) server.',
      // schema: DisconnectServerInputSchema,
      func: async (_input: z.infer<typeof DisconnectServerInputSchema>) => this.disconnectFromServer(),
    });

    return [
      listServersTool,
      connectServerTool,
      getActiveServerTool,
      disconnectServerTool,
    ];
  }

  async listServers(): Promise<string> {
    logger.info('Listing available MCP servers...');
    const serverNames = this.client.getServerNames();
    if (serverNames.length === 0) {
      return 'No MCP servers are currently defined.';
    }

    let result = 'Available MCP servers:\n';
    for (let i = 0; i < serverNames.length; i++) {
      const serverName = serverNames[i];
      const activeMarker = serverName === this.activeServer ? ' (ACTIVE)' : '';
      result += `${i + 1}. ${serverName}${activeMarker}\n`;

      let tools: StructuredTool[] = [];
      try {
        // Check cache first
        if (this.serverToolsCache[serverName]) {
          tools = this.serverToolsCache[serverName];
          logger.debug(`Using cached tools for server '${serverName}'.`);
        } else {
          // Attempt to get/create session without setting active
          let session: MCPSession | null = null;
          try {
            session = this.client.getSession(serverName);
            logger.debug(`Using existing session for server '${serverName}' to list tools.`);
          } catch (e) {
            try {
              // Create session temporarily if it doesn't exist
              session = await this.client.createSession(serverName, true); // Initialize to get tools
              logger.debug(`Temporarily created session for server '${serverName}' to list tools.`);
              // We might not want to keep this session active if just listing
              // Consider closing it if it wasn't pre-existing, or rely on client management
            } catch (createError) {
              logger.warn(`Could not create or get session for server '${serverName}': ${createError}`);
            }
          }

          // Fetch tools if session is available
          if (session) {
            try {
              // Assuming adapter.loadToolsForConnector fetches/caches tools
              const fetchedTools = await this.adapter.loadToolsForConnector(session.connector);
              this.serverToolsCache[serverName] = fetchedTools; // Cache tools
              this.initializedServers[serverName] = true; // Mark as initialized
              tools = fetchedTools;
              logger.debug(`Fetched ${tools.length} tools for server '${serverName}'.`);
            } catch (fetchError) {
              logger.warn(`Could not fetch tools for server '${serverName}': ${fetchError}`);
            }
          }
        }

        // Append tool names to the result string
        if (tools.length > 0) {
          const toolNames = tools.map(tool => tool.name).join(', ');
          result += `   Tools: ${toolNames}\n`;
        } else {
          result += '   Tools: (Could not retrieve or none available)\n';
        }
      } catch (error) {
        logger.error(`Unexpected error listing tools for server '${serverName}': ${error}`);
        result += '   Tools: (Error retrieving tools)\n';
      }
    }
    return result;
  }

  async connectToServer(serverName: string): Promise<string> {
    logger.info(`Attempting to connect to server: ${serverName}`);
    const serverNames = this.client.getServerNames();
    if (!serverNames.includes(serverName)) {
      const available = serverNames.length > 0 ? serverNames.join(', ') : 'none';
      return `Server '${serverName}' not found. Available servers: ${available}`;
    }

    if (this.activeServer === serverName) {
      return `Already connected to MCP server '${serverName}'.`;
    }

    try {
      // Get or create session
      let session: MCPSession;
      try {
        session = this.client.getSession(serverName);
        logger.debug(`Using existing session for server '${serverName}'.`);
      } catch (e) {
        logger.debug(`Creating new session for server '${serverName}'.`);
        session = await this.client.createSession(serverName, true); // Ensure initialized
      }

      // Set as active server
      this.activeServer = serverName;

      // Ensure tools are loaded/cached
      if (!this.serverToolsCache[serverName]) {
        logger.debug(`Loading tools for newly activated server '${serverName}'.`);
        const tools = await this.adapter.loadToolsForConnector(session.connector);
        this.serverToolsCache[serverName] = tools;
        this.initializedServers[serverName] = true;
        logger.debug(`Loaded ${tools.length} tools for server '${serverName}'.`);
      }

      return `Successfully connected to MCP server '${serverName}'. You can now use its tools.`;
    } catch (error) {
      logger.error(`Failed to connect to server '${serverName}': ${error}`);
      this.activeServer = null; // Reset active server on failure
      return `Failed to connect to server '${serverName}': ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async getActiveServer(): Promise<string> {
    if (this.activeServer) {
      return `Currently active MCP server: ${this.activeServer}`;
    } else {
      return 'No MCP server is currently active. Use `list_mcp_servers` to see available servers and `connect_to_mcp_server` to connect.';
    }
  }

  async disconnectFromServer(): Promise<string> {
    if (!this.activeServer) {
      return 'Not connected to any MCP server.';
    }

    logger.info(`Disconnecting from active server: ${this.activeServer}`);
    const serverNameToDisconnect = this.activeServer;
    this.activeServer = null;

    // Optionally, you might want to close the session in the client
    // await this.client.closeSession(serverNameToDisconnect);
    // logger.debug(`Session closed for server '${serverNameToDisconnect}'.`);

    return `Disconnected from MCP server '${serverNameToDisconnect}'.`;
  }

  // Method to get tools for the currently active server
  getActiveServerTools(): StructuredTool[] {
    if (!this.activeServer) {
      logger.warn('Request for active server tools, but no server is active.');
      return [];
    }
    const tools = this.serverToolsCache[this.activeServer];
    if (!tools) {
      logger.warn(`No tools found or cached for active server '${this.activeServer}'.`);
      return [];
    }
    logger.debug(`Returning ${tools.length} tools for active server '${this.activeServer}'.`);
    return tools;
  }
}