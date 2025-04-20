// Base connector for MCP implementations in TypeScript
// This module provides the base connector interface that all MCP connectors must implement.

import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { logger } from '../logging';
import { ConnectionManager } from '../task_managers/base'; // Assuming ConnectionManager is in task_managers/base
// Hypothetical import for MCP client session and types. Replace with actual library/types.
// import { ClientSession, Tool, CallToolResult, Resource } from 'mcp-client-library';

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Tool } from '@modelcontextprotocol/sdk/types';

// Placeholder types - replace with actual types from an MCP library or define them
// type ClientSession = any; 
// type Tool = { name: string; [key: string]: any };
type CallToolResult = any;
type Resource = { content: Buffer; mimeType: string };

export abstract class BaseConnector {
  protected client: Client | null = null;
  protected _connectionManager: ConnectionManager<any> | null = null; // Use appropriate type for connection
  protected _tools: Tool[] | null = null;
  protected _connected: boolean = false;

  constructor(client: Client) {
    this.client = client;
    // Initialization common to all connectors can go here
  }

  /**
   * Establish a connection to the MCP implementation.
   * This method must be implemented by subclasses to handle specific connection logic
   * and set up the `client` and `_connectionManager`.
   */
  abstract connect(): Promise<void>;

  abstract  createTransport(): Promise<Transport>;

  /**
   * Close the connection to the MCP implementation.
   */
  async disconnect(): Promise<void> {
    if (!this._connected) {
      logger.debug('BaseConnector: Not connected, nothing to disconnect.');
      return;
    }

    logger.debug('BaseConnector: Disconnecting from MCP implementation...');
    await this._cleanupResources();
    this._connected = false;
    logger.debug('BaseConnector: Disconnected.');
  }

  /**
   * Clean up all resources associated with this connector.
   * Ensures client session and connection manager are properly closed.
   */
  protected async _cleanupResources(): Promise<void> {
    const errors: string[] = [];
    logger.debug('BaseConnector: Cleaning up resources...');

    // First close the client session (assuming it has an async __aexit__ or similar close method)
    if (this.client && typeof this.client.close === 'function') {
      try {
        logger.debug('BaseConnector: Closing client session...');
        await this.client.close();
        logger.debug('BaseConnector: Client session closed.');
      } catch (e: any) {
        const errorMsg = `BaseConnector: Error closing client session: ${e.message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      } finally {
        this.client = null;
      }
    } else if (this.client) {
        logger.warn('BaseConnector: Client session exists but has no standard __aexit__ method for cleanup.');
        // Attempt other potential close methods or just nullify
        this.client = null;
    }

    // Then stop the connection manager
    if (this._connectionManager) {
      try {
        logger.debug('BaseConnector: Stopping connection manager...');
        await this._connectionManager.stop();
        logger.debug('BaseConnector: Connection manager stopped.');
      } catch (e: any) {
        const errorMsg = `BaseConnector: Error stopping connection manager: ${e.message}`;
        logger.warn(errorMsg);
        errors.push(errorMsg);
      } finally {
        this._connectionManager = null;
      }
    }

    // Reset tools cache
    this._tools = null;

    if (errors.length > 0) {
      logger.warn(`BaseConnector: Encountered ${errors.length} errors during resource cleanup.`);
    }
    logger.debug('BaseConnector: Resource cleanup finished.');
  }

  /**
   * Initialize the MCP session and return session information.
   * Fetches available tools after successful initialization.
   * @returns Session information object.
   * @throws RuntimeError if the client is not connected.
   */
  async initialize(): Promise<Record<string, any>> {
    if (!this.client || !this._connected) {
      logger.error('BaseConnector: Cannot initialize, client is not connected.');
      throw new Error('MCP client is not connected');
    }

    logger.debug('BaseConnector: Initializing MCP session...');
    // Assuming client.initialize() returns session info
    // this.client = new Client({ name: "mcp-client-cli", version: "1.0.0" });
    // const result = await this.client.initialize(); 
    logger.debug('BaseConnector: MCP session initialized, fetching tools...');

    // Get available tools
    // Assuming client.list_tools() returns { tools: Tool[] }
    const toolsResult = await this.client.listTools();
    this._tools = toolsResult.tools;

    logger.info(`BaseConnector: Initialization complete. Discovered ${this._tools?.length ?? 0} tools.`);
    return this.client;
  }

  /**
   * Get the list of available tools.
   * @returns Array of discovered tools.
   * @throws RuntimeError if the client is not initialized (tools haven't been fetched).
   */
  getTools(): Tool[] {
    if (this._tools === null) {
        // Changed from Python's check for None to check for null
        logger.error('BaseConnector: Cannot get tools, client is not initialized or tools not fetched.');
        throw new Error('MCP client is not initialized or tools not fetched');
    }
    return this._tools;
  }

  /**
   * Check if the connector is currently connected.
   * @returns True if connected, false otherwise.
   */
  isConnected(): boolean {
      return this._connected;
  }

  /**
   * Call an MCP tool with the given arguments.
   * @param name The name of the tool to call.
   * @param args The arguments to pass to the tool.
   * @returns The result of the tool call.
   * @throws RuntimeError if the client is not connected.
   */
  async callTool(name: string, args: Record<string, any>): Promise<CallToolResult> {
    if (!this.client || !this._connected) {
      logger.error(`BaseConnector: Cannot call tool '${name}', client is not connected.`);
      throw new Error('MCP client is not connected');
    }

    logger.debug(`BaseConnector: Calling tool '${name}' with arguments:`, args);
    // Assuming client.call_tool returns the result directly
    const result = await this.client.callTool({name:name, arguments:args});
    logger.debug(`BaseConnector: Tool '${name}' call result:`, result);
    return result;
  }

  /**
   * List all available resources from the MCP implementation.
   * @returns Array of resource descriptions.
   * @throws RuntimeError if the client is not connected.
   */
  async listResources(): Promise<any> {
    if (!this.client || !this._connected) {
      logger.error('BaseConnector: Cannot list resources, client is not connected.');
      throw new Error('MCP client is not connected');
    }

    logger.debug('BaseConnector: Listing resources...');
    // Assuming client.list_resources returns the array directly
    const resources = await this.client.listResources();
    logger.debug(`BaseConnector: Found ${resources.length} resources.`);
    return resources;
  }

  /**
   * Read a resource by URI.
   * @param uri The URI of the resource to read.
   * @returns A tuple containing the resource content (Buffer) and its MIME type (string).
   * @throws RuntimeError if the client is not connected.
   */
  async readResource(uri: string)  {
    if (!this.client || !this._connected) {
      logger.error(`BaseConnector: Cannot read resource '${uri}', client is not connected.`);
      throw new Error('MCP client is not connected');
    }

    logger.debug(`BaseConnector: Reading resource: ${uri}`);
    // Assuming client.read_resource returns { content: Buffer, mimeType: string }
    const resource = await this.client.readResource({uri:uri});
    logger.debug(`BaseConnector: Resource '${uri}' read successfully (MIME type: ${resource.mimeType}).`);
    return resource;
  }

  // /**
  //  * Send a raw request to the MCP implementation.
  //  * @param method The method name for the request.
  //  * @param params Optional parameters for the request.
  //  * @returns The result from the MCP implementation.
  //  * @throws RuntimeError if the client is not connected.
  //  */
  // async request(method: string, params?: Record<string, any>): Promise<any> {
  //   if (!this.client || !this._connected) {
  //     logger.error(`BaseConnector: Cannot send request '${method}', client is not connected.`);
  //     throw new Error('MCP client is not connected');
  //   }

  //   const requestPayload = { method: method, params: params || {} };
  //   logger.debug(`BaseConnector: Sending raw request:`, requestPayload);
  //   // Assuming client.request takes the payload object 
  //   // Assuming request is a method on the client (not shown in the provided code snippet)
  //   const result = await this.client.request(requestPayload);
  //   logger.debug(`BaseConnector: Raw request '${method}' result:`, result);
  //   return result;
  // }
}