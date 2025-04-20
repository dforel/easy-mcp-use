// Base connection manager for MCP implementations in TypeScript

import { EventEmitter } from 'events';
import { logger } from '../logging'; // Assuming logger is defined

/**
 * Abstract base class for connection managers.
 *
 * Defines the interface for managing the lifecycle of different connection types
 * used by MCP connectors.
 */
export abstract class ConnectionManager<T> extends EventEmitter {
  protected connection: T | null = null;
  protected isReady: boolean = false;
  protected error: Error | null = null;
  private connectPromise: Promise<T> | null = null;
  private disconnectPromise: Promise<void> | null = null;

  constructor() {
    super();
  }

  /**
   * Establishes the connection.
   * Must be implemented by subclasses.
   */
  protected abstract _establishConnection(): Promise<T>;

  /**
   * Closes the connection.
   * Must be implemented by subclasses.
   */
  protected abstract _closeConnection(connection: T): Promise<void>;

  /**
   * Starts the connection manager and establishes a connection.
   * Ensures connection logic runs only once concurrently.
   *
   * @returns The established connection.
   */
  async start(): Promise<T> {
    if (this.connection) {
      logger.debug(`${this.constructor.name}: Connection already established.`);
      return this.connection;
    }

    if (this.connectPromise) {
      logger.debug(`${this.constructor.name}: Connection attempt already in progress.`);
      return this.connectPromise;
    }

    logger.debug(`Starting ${this.constructor.name}...`);
    this.isReady = false;
    this.error = null;

    this.connectPromise = (async () => {
      try {
        this.connection = await this._establishConnection();
        this.isReady = true;
        this.error = null;
        logger.debug(`${this.constructor.name}: Connection established successfully.`);
        this.emit('ready', this.connection);
        return this.connection;
      } catch (err: any) {
        this.error = err instanceof Error ? err : new Error(String(err));
        this.isReady = false;
        this.connection = null;
        logger.error(`Error in ${this.constructor.name}: ${this.error.message}`);
        this.emit('error', this.error);
        throw this.error; // Re-throw after emitting
      } finally {
        this.connectPromise = null; // Clear promise once done
      }
    })();

    return this.connectPromise;
  }

  /**
   * Stops the connection manager and closes the connection.
   * Ensures disconnection logic runs only once concurrently.
   */
  async stop(): Promise<void> {
    if (!this.connection && !this.connectPromise) {
        logger.debug(`${this.constructor.name}: Not connected or connecting, nothing to stop.`);
        return;
    }

    if (this.disconnectPromise) {
        logger.debug(`${this.constructor.name}: Disconnection already in progress.`);
        return this.disconnectPromise;
    }

    // If connection is still in progress, wait for it before disconnecting
    if (this.connectPromise) {
        try {
            await this.connectPromise;
        } catch (e) {
            // Connection failed, nothing more to do here
            logger.debug(`${this.constructor.name}: Connection failed during start, stopping.`);
            this.disconnectPromise = null; // Reset disconnect promise
            return;
        }
    }

    if (!this.connection) {
        logger.debug(`${this.constructor.name}: Connection is null after waiting, nothing to stop.`);
        return;
    }

    logger.debug(`Stopping ${this.constructor.name}...`);

    this.disconnectPromise = (async () => {
        const connToClose = this.connection!;
        this.connection = null; // Mark as disconnected immediately
        this.isReady = false;
        try {
            await this._closeConnection(connToClose);
            logger.debug(`${this.constructor.name}: Connection closed successfully.`);
            this.emit('close');
        } catch (err: any) {
            const closeError = err instanceof Error ? err : new Error(String(err));
            logger.warn(`Error closing connection in ${this.constructor.name}: ${closeError.message}`);
            this.emit('error', closeError);
            // Decide if we should throw here or just log
        } finally {
            this.disconnectPromise = null; // Clear promise once done
        }
    })();

    return this.disconnectPromise;
  }

  /**
   * Gets the current connection status.
   */
  getConnectionStatus(): { isReady: boolean; error: Error | null } {
    return { isReady: this.isReady, error: this.error };
  }

  /**
   * Gets the active connection, throwing an error if not ready.
   */
  getActiveConnection(): T {
    if (!this.isReady || !this.connection) {
      throw new Error(`${this.constructor.name} is not connected or ready.`);
    }
    return this.connection;
  }
}