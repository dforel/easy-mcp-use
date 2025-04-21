// Client for managing MCP servers and sessions in TypeScript
// This module provides a high-level client that manages MCP servers, connectors,
// and sessions from configuration.

import * as fs from 'fs/promises';
import { BaseConnector } from './connectors/base'; // Assuming base connector interface
import { createConnectorFromConfig, ServerConfig, MCPClientConfig } from './config'; // Use config functions/types
import { logger } from './logging';
import { MCPSession } from './session';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export class MCPClient {
  public config: MCPClientConfig;
  public sessions: Record<string, MCPSession> = {};
  public activeSessions: string[] = [];

  constructor(config?: MCPClientConfig) {
    // Initialize with provided config or empty object
    this.config = config || {};
    if (!this.config.mcpServers) {
        this.config.mcpServers = {}; // Ensure mcpServers exists
    }
  }

  static fromConfig(config: MCPClientConfig): MCPClient {
    return new MCPClient(config);
  }
  // 兼容mcp-use的设计
  static fromDict(config: MCPClientConfig): MCPClient {
    return new MCPClient(config);
  }

  static async fromConfigFile(filepath: string): Promise<MCPClient> {
    logger.debug(`Loading configuration from file: ${filepath}`);
    try {
      const fileContent = await fs.readFile(filepath, 'utf-8');
      const config = JSON.parse(fileContent) as MCPClientConfig;
      logger.info(`Configuration loaded successfully from ${filepath}`);
      return new MCPClient(config);
    } catch (error: any) {
      logger.error(`Failed to load or parse config file ${filepath}: ${error.message}`);
      throw new Error(`Failed to load config file: ${filepath}`);
    }
  }

  addServer(name: string, serverConfig: ServerConfig): void {
    if (!this.config.mcpServers) {
      this.config.mcpServers = {};
    }
    this.config.mcpServers[name] = serverConfig;
    logger.info(`Server configuration '${name}' added.`);
  }

  removeServer(name: string): void {
    if (this.config.mcpServers && name in this.config.mcpServers) {
      delete this.config.mcpServers[name];
      logger.info(`Server configuration '${name}' removed.`);

      // If we removed an active session, remove it from activeSessions
      const index = this.activeSessions.indexOf(name);
      if (index > -1) {
        this.activeSessions.splice(index, 1);
        logger.debug(`Removed server '${name}' from active sessions.`);
      }

      // Optionally close and remove the session instance
      if (name in this.sessions) {
          this.closeSession(name).catch(err => {
              logger.error(`Error closing session for removed server '${name}': ${err}`);
          });
      }
    } else {
      logger.warn(`Server configuration '${name}' not found, cannot remove.`);
    }
  }

  getServerNames(): string[] {
    return Object.keys(this.config.mcpServers || {});
  }

  async saveConfig(filepath: string): Promise<void> {
    logger.debug(`Saving configuration to file: ${filepath}`);
    try {
      const configString = JSON.stringify(this.config, null, 2); // Pretty print JSON
      await fs.writeFile(filepath, configString, 'utf-8');
      logger.info(`Configuration saved successfully to ${filepath}`);
    } catch (error: any) {
      logger.error(`Failed to save config to ${filepath}: ${error.message}`);
      throw new Error(`Failed to save config file: ${filepath}`);
    }
  }

  async createSession(serverName: string, autoInitialize: boolean = true): Promise<MCPSession> {
    logger.debug(`Attempting to create session for server: '${serverName}'`);
    const servers = this.config.mcpServers;
    if (!servers) {
      logger.error('Cannot create session: No MCP servers defined in config.');
      throw new Error('No MCP servers defined in config');
    }
    const serverConfig = servers[serverName];
    if (!serverConfig) {
      logger.error(`Cannot create session: Server '${serverName}' not found in config.`);
      throw new Error(`Server '${serverName}' not found in config`);
    }

    let connector: BaseConnector;
    try {
        // Pass 'this' (MCPClient instance) if connectors need it, adjust createConnectorFromConfig accordingly
        let client = new Client({ name: "mcp-client-cli", version: "1.0.0" },
          {
              capabilities: {
                  prompts: {},
                  resources: {},
                  tools: {}
              }
          });
        connector = createConnectorFromConfig(client, serverConfig);
        let transport = await connector.createTransport(); 
        await client.connect(transport);
        
        logger.info(`Connector created for server '${serverName}' with type '${serverConfig}'.`);
    } catch (error: any) {
        logger.error(`Failed to create connector for server '${serverName}': ${error.message}`);
        throw error; // Re-throw connector creation error
    }

    if (!connector) {
      throw new Error(`connector fail`);
    }

    const session = new MCPSession(connector);
    logger.info(`MCPSession instance created for server '${serverName}'.`);

    if (autoInitialize) {
      logger.debug(`Auto-initializing session for server '${serverName}'...`);
      try {
        await session.initialize(); // This now includes connect and discoverTools
        logger.info(`Session for server '${serverName}' initialized successfully.`);
      } catch (error: any) { 
        logger.error(error);
        const stackTrace = error.stack;
        logger.error(stackTrace);
        logger.error(`Failed to auto-initialize session for server '${serverName}': ${error.message}`);
        // Decide whether to still add the session or re-throw
        // Let's add it but log the error. The session might be usable later or manually initialized.
        // Consider re-throwing if initialization is absolutely critical for the session to be valid.
        // await session.disconnect(); // Optionally disconnect if init failed
      }
    }

    this.sessions[serverName] = session;
    if (!this.activeSessions.includes(serverName)) {
      this.activeSessions.push(serverName);
      logger.debug(`Server '${serverName}' added to active sessions.`);
    }

    return session;
  }

  async createAllSessions(autoInitialize: boolean = true): Promise<Record<string, MCPSession>> {
    const serverNames = this.getServerNames();
    logger.info(`Attempting to create sessions for all ${serverNames.length} configured servers.`);
    if (serverNames.length === 0) {
      logger.warn('No MCP servers defined in config to create sessions for.');
      return {};
    }

    const results: Record<string, MCPSession> = {};
    for (const name of serverNames) {
      try {
        const session = await this.createSession(name, autoInitialize);
        results[name] = session;
      } catch (error: any) {
        logger.error(`Failed to create or initialize session for server '${name}': ${error.message}`);
        // Continue creating other sessions
      }
    }
    logger.info(`Finished creating sessions. ${Object.keys(results).length} sessions successfully created/added.`);
    return results; // Return only successfully created sessions map
  }

  getSession(serverName: string): MCPSession {
    const session = this.sessions[serverName];
    if (!session) {
      logger.error(`No session found for server '${serverName}'. Was it created?`);
      throw new Error(`No session exists for server '${serverName}'`);
    }
    return session;
  }

  getAllActiveSessions(): Record<string, MCPSession> {
    const active: Record<string, MCPSession> = {};
    for (const name of this.activeSessions) {
      if (this.sessions[name]) {
        active[name] = this.sessions[name];
      }
    }
    logger.debug(`Returning ${Object.keys(active).length} active sessions.`);
    return active;
  }

  async closeSession(serverName: string): Promise<void> {
    const session = this.sessions[serverName];
    if (session) {
      logger.debug(`Closing session for server '${serverName}'...`);
      try {
        await session.disconnect();
        logger.info(`Session for server '${serverName}' disconnected successfully.`);
      } catch (error: any) {
        logger.error(`Error during disconnect for session '${serverName}': ${error.message}`);
        // Continue cleanup even if disconnect fails
      }
      delete this.sessions[serverName];
      const index = this.activeSessions.indexOf(serverName);
      if (index > -1) {
        this.activeSessions.splice(index, 1);
        logger.debug(`Server '${serverName}' removed from active sessions list.`);
      }
    } else {
      logger.warn(`No session found for server '${serverName}', nothing to close.`);
    }
  }

  async closeAllSessions(): Promise<void> {
    const sessionNames = Object.keys(this.sessions);
    logger.info(`Closing all ${sessionNames.length} sessions...`);
    const errors: string[] = [];

    for (const name of sessionNames) {
      try {
        await this.closeSession(name); // closeSession handles logging and removal
      } catch (error: any) { // Catch errors potentially thrown by closeSession itself (though it tries not to)
        const errorMsg = `Unexpected error during close_session for '${name}': ${error.message}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    if (errors.length > 0) {
        logger.error(`Encountered ${errors.length} errors while closing all sessions.`);
    } else {
        logger.info('All sessions closed successfully.');
    }
  }
}