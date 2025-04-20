// Logger module for mcp_use in TypeScript
// This module provides a centralized logging configuration.

import * as path from 'path';
import * as fs from 'fs';

// Define log levels similar to Python's logging module
enum LogLevel {
  DEBUG = 10,
  INFO = 20,
  WARNING = 30,
  ERROR = 40,
  CRITICAL = 50,
}

// Map level names to numbers
const LogLevelMap: { [key: string]: LogLevel } = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARNING: LogLevel.WARNING,
  ERROR: LogLevel.ERROR,
  CRITICAL: LogLevel.CRITICAL,
};

// Global debug flag - can be set programmatically or from environment
let MCP_USE_DEBUG: number = 0; // 0=off, 1=info, 2=debug

// Basic Console Transport (can be replaced with a more robust logging library like Winston or Pino)
interface LogTransport {
  log(level: LogLevel, name: string, message: string, timestamp: Date): void;
  close?(): void; // Optional close method for transports like file streams
}

class ConsoleTransport implements LogTransport {
  private formatter: (level: LogLevel, name: string, message: string, timestamp: Date) => string;

  constructor(formatStr: string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s') {
    this.formatter = (level, name, message, timestamp) => {
      const levelName = Object.keys(LogLevelMap).find(key => LogLevelMap[key] === level) || 'UNKNOWN';
      return formatStr
        .replace('%(asctime)s', timestamp.toISOString())
        .replace('%(name)s', name)
        .replace('%(levelname)s', levelName)
        .replace('%(message)s', message);
    };
  }

  log(level: LogLevel, name: string, message: string, timestamp: Date): void {
    const formattedMessage = this.formatter(level, name, message, timestamp);
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARNING:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }
}

class FileTransport implements LogTransport {
    private stream: fs.WriteStream;
    private formatter: (level: LogLevel, name: string, message: string, timestamp: Date) => string;

    constructor(filePath: string, formatStr: string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s') {
        const logDir = path.dirname(filePath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        this.stream = fs.createWriteStream(filePath, { flags: 'a' });
        this.formatter = (level, name, message, timestamp) => {
            const levelName = Object.keys(LogLevelMap).find(key => LogLevelMap[key] === level) || 'UNKNOWN';
            return formatStr
              .replace('%(asctime)s', timestamp.toISOString())
              .replace('%(name)s', name)
              .replace('%(levelname)s', levelName)
              .replace('%(message)s', message) + '\n'; // Add newline for file logs
        };
    }

    log(level: LogLevel, name: string, message: string, timestamp: Date): void {
        const formattedMessage = this.formatter(level, name, message, timestamp);
        this.stream.write(formattedMessage);
    }

    close(): void {
        this.stream.end();
    }
}


class Logger {
  private name: string;
  private level: LogLevel;
  private static transports: LogTransport[] = [];
  private static _loggers: { [name: string]: Logger } = {};

  private constructor(name: string) {
    this.name = name;
    this.level = Logger.getDefaultLevel(); // Set initial level
  }

  static getLogger(name: string = 'mcp_use'): Logger {
    if (!Logger._loggers[name]) {
      Logger._loggers[name] = new Logger(name);
      // Ensure the new logger gets the currently configured level
      Logger._loggers[name].setLevel(LogLevel.DEBUG);  
    }
    return Logger._loggers[name];
  }

  private static getDefaultLevel(): LogLevel {
    if (MCP_USE_DEBUG === 2) return LogLevel.DEBUG;
    if (MCP_USE_DEBUG === 1) return LogLevel.INFO;
    return LogLevel.WARNING;
  }

  // Helper to get the level that should be applied to all loggers
  private static getCurrentLevelForAllLoggers(): LogLevel {
      // Find the level of the root logger if it exists, otherwise use default
      const rootLogger = Logger._loggers['mcp_use'];
      return rootLogger ? rootLogger.level : Logger.getDefaultLevel();
  }

  static configure(
    logToFile?: string,
    level?: LogLevel | string,
    formatStr?: string,
    logToConsole: boolean = true,
  ): void {
    let numericLevel: LogLevel;
    if (level === undefined) {
        numericLevel = Logger.getDefaultLevel();
    } else if (typeof level === 'string') {
        numericLevel = LogLevelMap[level.toUpperCase()] ?? Logger.getDefaultLevel();
    } else {
        numericLevel = level;
    }

    // Close existing file transports before clearing
    Logger.transports.forEach(transport => {
        if (transport instanceof FileTransport) {
            transport.close();
        }
    });
    Logger.transports = [];

    // Add console transport
    if (logToConsole) {
      Logger.transports.push(new ConsoleTransport(formatStr));
    }

    // Add file transport
    if (logToFile) {
        try {
            Logger.transports.push(new FileTransport(logToFile, formatStr));
        } catch (error: any) {
            console.error(`Failed to configure file logging: ${error.message}`);
        }
    }

    // Update level for all existing loggers
    for (const loggerName in Logger._loggers) {
      Logger._loggers[loggerName].setLevel(numericLevel);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level >= this.level) {
      const timestamp = new Date();
      // Simple argument formatting (consider more robust formatting if needed)
      const formattedArgs = args.map(arg => {
          try {
              return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
          } catch (e) {
              return '[Unserializable Argument]';
          }
      }).join(' ');
      const fullMessage = args.length > 0 ? `${message} ${formattedArgs}` : message;
      Logger.transports.forEach(transport => {
        transport.log(level, this.name, fullMessage, timestamp);
      });
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARNING, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, message, ...args);
  }

  critical(message: string, ...args: any[]): void {
    this.log(LogLevel.CRITICAL, message, ...args);
  }

  static setDebug(debugLevel: number = 2): void {
    MCP_USE_DEBUG = debugLevel;
    const newLevel = Logger.getDefaultLevel();
    console.log(`Setting debug level to ${debugLevel}. Global log level set to: ${Object.keys(LogLevelMap).find(key => LogLevelMap[key] === newLevel)}`);
    // Update level for all existing loggers
    for (const loggerName in Logger._loggers) {
        Logger._loggers[loggerName].setLevel(newLevel);
    }
    // Note: Langchain debug setting needs separate handling if used
    // Example: import { setDebug as langchainSetDebug } from 'langchain/globals';
    // langchainSetDebug(debugLevel >= 2);
  }
}

// Check environment variable for debug flag
const debugEnv = process.env['DEBUG']?.toLowerCase();
if (debugEnv === '2') {
  MCP_USE_DEBUG = 2;
} else if (debugEnv === '1') {
  MCP_USE_DEBUG = 1;
}

// Configure default logger on import
Logger.configure("./log.txt");

// Export a default logger instance
export const logger = Logger.getLogger();

// Export the class and level enum for custom configuration
export { Logger, LogLevel };