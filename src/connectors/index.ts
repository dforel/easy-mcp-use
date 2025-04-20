import WebSocket from 'ws';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'; // Added import for child_process
import { BaseConnector } from './base';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { Transport } from '@modelcontextprotocol/sdk/shared/transport';
import { HttpServerConfig, WebSocketServerConfig } from '@/config';


export class WebSocketConnector extends BaseConnector {
  async createTransport(): Promise<Transport> {
    let transport = new WebSocketClientTransport(new URL(this.ws_url));
    return transport;
  }
  private ws?: WebSocket;
  private ws_url: string;
  private authToken?: string;
  private headers?: Record<string, string>;

  constructor( client: Client, websocketConfig: WebSocketServerConfig) {
    super(client);
    this.ws_url = websocketConfig.ws_url; 
    this.authToken = websocketConfig.authToken || "";
    this.headers = websocketConfig.headers || {};
    // headers["Authorization"] = `Bearer ${authToken}`;
  }
 

  async connect(): Promise<void> { 
    // let wsconfig = this.client.config.mcpServers;
    // 待实现
    this.ws = new WebSocket("");
    return new Promise((resolve, reject) => {
      this.ws?.on('open', () => resolve());
      this.ws?.on('error', (err) => reject(err));
    });
  }

  // disconnect(): void {
  //   this.ws?.close();
  // }

  async send(data: any): Promise<void> {
    if (!this.ws) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(data));
  }
}

export class HTTPConnector extends BaseConnector {
  async createTransport(): Promise<Transport> {
    let transport = new SSEClientTransport(new URL(this.url));
    return transport;
  }
  async connect(): Promise<void> {
    console.log('HTTPConnector: Connecting...');
    this._connected = true; // Assuming HTTP is stateless, so we mark as connected immediately
    // 待实现
    // HTTP connection is stateless, no persistent connection needed
    return Promise.resolve();
  }

  private url: string; // Assuming the URL includes the /api endpoint for HTTP request
  
  constructor( client: Client, httpConfig: HttpServerConfig) {
    super(client);
    this.url = httpConfig.url; 
  }

  // disconnect(): void {
  //   // No persistent connection to disconnect
  // }

  async send(data: any): Promise<void> {
    // 待实现
    // Assuming the MCPClient config has the full URL including /api
    // let httpConfig = this.client.config as HttpServerConfig;
    // await axios.post(httpConfig.url, data);
  }
}

// Added StdioConnector based on Python version
export class StdioConnector extends BaseConnector {
  private process?: ChildProcessWithoutNullStreams;
  private command: string;
  private args: string[];
  private env?: NodeJS.ProcessEnv;

  constructor( client: Client, command: string, args: string[] = [], env?: NodeJS.ProcessEnv) {
    super(client);
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async createTransport(): Promise<StdioClientTransport> {
    const command = this.command;
    const args = this.args;
    const serverParams: StdioServerParameters = {
        command,
        args,
        env: Object.fromEntries(
            Object.entries(process.env).filter(([_, v]) => v !== undefined)
        ) as Record<string, string>
    };
    const transport = new StdioClientTransport(serverParams); 
    return transport;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, { 
          env: this.env, 
          stdio: ['pipe', 'pipe', 'pipe'] 
          ,
          // 仅在当前运行环境为 Windows 时，才使用 shell
          shell: process.platform === 'win32'
        });

        this.process.on('spawn', () => {
          console.log(`StdioConnector: Process spawned successfully (PID: ${this.process?.pid})`);
          // Consider the connection successful once the process spawns
          // More robust checks might involve waiting for an initial message
          resolve();
        });

        this.process.on('error', (err) => {
          console.error('StdioConnector: Failed to start subprocess.', err);
          this.process = undefined;
          reject(err);
        });

        this.process.stderr.on('data', (data) => {
          console.error(`StdioConnector stderr: ${data}`);
        });

        this.process.on('close', (code) => {
          console.log(`StdioConnector: Process exited with code ${code}`);
          this.process = undefined;
          // Handle reconnection or notify client if needed
        });

        // Handle stdout data (incoming messages from the process)
        this.process.stdout.on('data', (data) => {
          // TODO: Implement message parsing and handling logic
          // This likely involves buffering, splitting messages (e.g., by newline),
          // and parsing JSON-RPC messages similar to WebSocket/HTTP connectors
          console.log(`StdioConnector stdout: ${data}`);
          // Example: this.client.handleMessage(JSON.parse(data.toString()));
        });

        this._connected = true;

      } catch (err) {
        console.error('StdioConnector: Error spawning process.', err);
        reject(err);
      }
    });
  }

  // disconnect(): void {
  //   if (this.process) {
  //     console.log(`StdioConnector: Terminating process (PID: ${this.process.pid})`);
  //     this.process.kill();
  //     this.process = undefined;
  //   }
  // }

  async send(data: any): Promise<void> {
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) {
      throw new Error('Stdio process not connected or stdin is not writable');
    }
    try {
      // Ensure data is stringified and ends with a newline, as stdio protocols often expect line-based messages
      const message = JSON.stringify(data) + '\n';
      this.process.stdin.write(message);
    } catch (error) {
      console.error('StdioConnector: Error writing to stdin:', error);
      throw error;
    }
  }
}