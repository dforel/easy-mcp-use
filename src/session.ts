// Session manager for MCP connections in TypeScript
// This module provides a session manager for MCP connections,
// which handles authentication, initialization, and tool discovery.

import { BaseConnector } from './connectors/base';
import { logger } from './logging';

// Define types for session info and tools (adjust as needed based on actual MCP spec)
// interface SessionInfo {
//   [key: string]: any; // Or a more specific type
// }

interface McpTool {
  name: string;
  description?: string;
  arguments?: object; // Define argument structure if known
  [key: string]: any; // Allow other properties
}

export class MCPSession {
  public connector: BaseConnector;
  // public sessionInfo: SessionInfo | null = null;
  public tools: McpTool[] = [];
  private autoConnect: boolean;

  constructor(connector: BaseConnector, autoConnect: boolean = true) {
    this.connector = connector;
    this.autoConnect = autoConnect;
  }

  // Simulate Python's async context manager behavior
  async __aenter__(): Promise<MCPSession> {
    await this.connect();
    return this;
  }

  async __aexit__(exc_type?: any, exc_val?: any, exc_tb?: any): Promise<void> {
    // Log error if exiting due to an exception
    if (exc_type) {
        logger.error(`MCPSession: Exiting context due to error: ${exc_val}`);
    }
    await this.disconnect();
  }

  async connect(): Promise<void> {
    logger.debug('MCPSession: Connecting...');
    await this.connector.connect();
    logger.debug('MCPSession: Connector connected.');
  }

  async disconnect(): Promise<void> {
    logger.debug('MCPSession: Disconnecting...');
    await this.connector.disconnect();
    logger.debug('MCPSession: Connector disconnected.');
  }

  async initialize(): Promise<void> {
    logger.debug('MCPSession: Initializing session...');
    // Make sure we're connected
    if (!this.isConnected && this.autoConnect) {
      logger.debug('MCPSession: Auto-connecting before initialization.');
      await this.connect();
    }

    if (!this.isConnected) {
        logger.error('MCPSession: Cannot initialize, connector is not connected.');
        throw new Error('Connector not connected');
    }

    // Initialize the session via the connector
    await this.connector.initialize();
    // logger.info('MCPSession: Session initialized.', this.sessionInfo);

    // Discover available tools
    await this.discoverTools();

    // return this.sessionInfo;
  }

  get isConnected(): boolean {
    // The logic depends on how the specific connector exposes its state.
    // Assuming the connector has an `isConnected` property or similar method.
    // Replace with actual check based on BaseConnector implementation.
    return this.connector.isConnected(); // Example: Assumes connector has isConnected method
  }

  async discoverTools(): Promise<McpTool[]> {
    logger.debug('MCPSession: Discovering tools...');
    if (!this.isConnected) {
        logger.warn('MCPSession: Cannot discover tools, connector is not connected.');
        return [];
    }
    // Assuming the connector fetches and stores tools upon initialization or has a method
    this.tools = this.connector.getTools(); // Example: Assumes connector has getTools method
    logger.info(`MCPSession: Discovered ${this.tools.length} tools.`);
    logger.debug('MCPSession: Discovered tools:', this.tools);
    return this.tools;
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    logger.debug(`MCPSession: Calling tool '${name}' with args:`, args);
    // Make sure we're connected
    if (!this.isConnected && this.autoConnect) {
      logger.debug('MCPSession: Auto-connecting before calling tool.');
      await this.connect();
    }

    if (!this.isConnected) {
        logger.error(`MCPSession: Cannot call tool '${name}', connector is not connected.`);
        throw new Error('Connector not connected');
    }

    const result = await this.connector.callTool(name, args);
    logger.debug(`MCPSession: Tool '${name}' call result:`, result);
    return result;
  }

  // Helper function to wrap usage in an async context manager pattern
  static async create(connector: BaseConnector, autoConnect: boolean = true): Promise<MCPSession> {
      const session = new MCPSession(connector, autoConnect);
      await session.__aenter__();
      return session;
  }
}