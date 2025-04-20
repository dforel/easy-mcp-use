// Configuration loader and connector factory for MCP session in TypeScript

import * as fs from 'fs/promises';
import {  WebSocketConnector, HTTPConnector, StdioConnector } from './connectors'; // Adjust path as needed
import { logger } from './logging';
// import { MCPClient } from './client';
import { BaseConnector } from './connectors/base';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Define types based on Python config structure and inference logic
// Note: We infer the type based on keys present, similar to the Python version.
interface BaseServerConfig {
  authToken?: string;
  headers?: Record<string, string>;
}

export interface WebSocketServerConfig extends BaseServerConfig {
  ws_url: string; // Key used for WebSocket inference
}

export interface HttpServerConfig extends BaseServerConfig {
  url: string; // Key used for HTTP inference
  timeout?: number;
  sseReadTimeout?: number;
}

export interface StdioServerConfig extends BaseServerConfig { // authToken/headers might not apply but kept for consistency
  command: string; // Key used for Stdio inference
  args: string[]; // Key used for Stdio inference
  env?: NodeJS.ProcessEnv;
}

// Union type for server configuration
export type ServerConfig = WebSocketServerConfig | HttpServerConfig | StdioServerConfig;

// Type for the overall client configuration file structure
export interface MCPClientConfig {
  mcpServers?: Record<string, ServerConfig>;
}

/**
 * Loads an MCP configuration from a JSON file asynchronously.
 *
 * @param filepath Path to the configuration file.
 * @returns The parsed configuration object.
 * @throws Error if the file cannot be read or parsed.
 */
export async function loadConfigFile(filepath: string): Promise<MCPClientConfig> {
  logger.debug(`Loading configuration from file: ${filepath}`);
  try {
    const fileContent = await fs.readFile(filepath, 'utf-8');
    const config: MCPClientConfig = JSON.parse(fileContent);
    logger.info(`Configuration loaded successfully from ${filepath}`);
    return config;
  } catch (error: any) {
    logger.error(`Failed to load or parse config file ${filepath}: ${error.message}`);
    throw new Error(`Failed to load config file: ${filepath}`);
  }
}


export async function loadConfigByMap(filepath: string): Promise<MCPClientConfig> {
  logger.debug(`Loading configuration from file: ${filepath}`);
  try {
    const fileContent = await fs.readFile(filepath, 'utf-8');
    const config: MCPClientConfig = JSON.parse(fileContent);
    logger.info(`Configuration loaded successfully from ${filepath}`);
    return config;
  } catch (error: any) {
    logger.error(`Failed to load or parse config file ${filepath}: ${error.message}`);
    throw new Error(`Failed to load config file: ${filepath}`);
  }
}

/**
 * Creates a connector instance based on the server configuration.
 * This function infers the connector type based on the keys present in the config,
 * similar to the Python implementation.
 *
 * @param serverConfig The configuration for a specific server.
 * @returns A configured BaseConnector instance.
 * @throws Error if the connector type cannot be determined or config is invalid.
 */
export function createConnectorFromConfig(client: Client , serverConfig: ServerConfig): BaseConnector {
  logger.debug('Attempting to create connector from config:', serverConfig);

  // Stdio connector inference (check for command and args)
  if ('command' in serverConfig && 'args' in serverConfig) {
    logger.info('Inferred StdioConnector type.');
    const stdioConfig = serverConfig as StdioServerConfig;
    return new StdioConnector(
      client,
      stdioConfig.command,
      stdioConfig.args,
      stdioConfig.env
    );
  }

  // WebSocket connector inference (check for ws_url)
  if ('ws_url' in serverConfig) {
    logger.info('Inferred WebSocketConnector type.'); 
    return new WebSocketConnector(
      client, serverConfig
    );
  }

  // HTTP connector inference (check for url)
  // This needs to be checked *after* ws_url if both could potentially exist,
  // although typically a config would have one or the other.
  if ('url' in serverConfig) {
    logger.info('Inferred HttpConnector type.'); 
    return new HTTPConnector(  
      client, serverConfig
    );
  }

  logger.error('Cannot determine connector type from config:', serverConfig);
  throw new Error('Cannot determine connector type from config. Ensure config has required keys (ws_url, url, or command/args).');
}