// WebSocket connection management for MCP implementations in TypeScript
// This module provides a connection manager for WebSocket-based MCP connections.

import { ConnectionManager } from './base';
import { logger } from '../logging';
// Assuming a WebSocket client library like 'ws' or native browser WebSocket
// Import the necessary types. For 'ws', it might be:
import WebSocket from 'ws'; // Or use native browser WebSocket type if applicable

// Define the connection type based on the library used
type WebSocketConnection = WebSocket; // Adjust if using a different library/type

export class WebSocketConnectionManager extends ConnectionManager<WebSocketConnection> {
  private url: string;
  private headers: Record<string, string>;
  private ws: WebSocketConnection | null = null; // Store the active connection

  constructor(
    url: string,
    headers?: Record<string, string>
  ) {
    super();
    this.url = url;
    this.headers = headers || {};
  }

  protected async _establishConnection(): Promise<WebSocketConnection> {
    logger.debug(`WebSocketConnectionManager: Connecting to WebSocket: ${this.url}`);
    return new Promise((resolve, reject) => {
      try {
        // Use 'ws' library syntax. Adjust if using native WebSocket.
        const ws = new WebSocket(this.url, {
          headers: this.headers,
        });

        ws.on('open', () => {
          logger.debug('WebSocketConnectionManager: Connection established.');
          this.ws = ws;
          resolve(ws);
        });

        ws.on('error', (error) => {
          logger.error(`WebSocketConnectionManager: Failed to connect to WebSocket: ${error.message}`);
          this.ws = null; // Clear reference on error
          reject(error);
        });

        // Optional: Handle close events during establishment if needed
        ws.on('close', (code, reason) => {
          if (!this.ws) { // If close happens before 'open'
            logger.warn(`WebSocketConnectionManager: Connection closed before establishment. Code: ${code}, Reason: ${reason}`);
            // Reject if the connection never opened successfully
            reject(new Error(`WebSocket closed before opening. Code: ${code}, Reason: ${reason.toString()}`));
          }
        });

      } catch (error: any) {
        logger.error(`WebSocketConnectionManager: Error initializing WebSocket connection: ${error.message}`);
        reject(error);
      }
    });
  }

  protected async _closeConnection(connection: WebSocketConnection): Promise<void> {
    logger.debug('WebSocketConnectionManager: Closing WebSocket connection...');
    if (connection && connection.readyState === WebSocket.OPEN) {
      return new Promise((resolve) => {
        connection.on('close', () => {
          logger.debug('WebSocketConnectionManager: WebSocket connection closed.');
          this.ws = null; // Clear reference
          resolve();
        });
        connection.on('error', (error) => {
            // Log error during close, but still resolve as we attempted to close
            logger.warn(`WebSocketConnectionManager: Error during WebSocket close: ${error.message}`);
            this.ws = null; // Clear reference
            resolve();
        });
        connection.close();
      });
    } else {
      logger.warn('WebSocketConnectionManager: Connection already closed or not established.');
      this.ws = null; // Ensure reference is cleared
      return Promise.resolve();
    }
  }
}