// Main integration module for MCP agent in TypeScript
// Requires langchain: npm install langchain @langchain/core @langchain/openai (or other provider)

// import { AgentExecutor } from '@langchain/core/agents';
import { AgentExecutor, createToolCallingAgent } from "langchain/agents"; 
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { BaseMessage, SystemMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { StructuredTool } from '@langchain/core/tools';
import { OutputParserException } from '@langchain/core/output_parsers';

import { MCPClient } from '../client';
import { BaseConnector } from '../connectors/base';
import { MCPSession } from '../session';
import { LangChainAdapter } from '../adapters/langchain_adapter';
import { logger } from '../logging';
import { ServerManager } from './server_manager';
// Assuming prompt building logic will be in a separate file
// import { createSystemMessage } from './prompts/system_prompt_builder';
// Assuming default templates will be defined
// import { DEFAULT_SYSTEM_PROMPT_TEMPLATE, SERVER_MANAGER_SYSTEM_PROMPT_TEMPLATE } from './prompts/templates';

// Placeholder for prompt templates - these should be defined properly
const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `You are a helpful assistant. You have access to the following tools:

{tool_descriptions}

You must always use the tools according to their instructions.`;
const SERVER_MANAGER_SYSTEM_PROMPT_TEMPLATE = `You are an assistant that manages connections to different MCP servers. First, use 'list_mcp_servers' to see available servers and their tools. Then, use 'connect_to_mcp_server' to connect to the desired server. Once connected, you can use the tools provided by that server. Available server management tools:

{tool_descriptions}`; 

// Placeholder for system message creation function
function createSystemMessage(options: { tools: StructuredTool[], system_prompt_template: string, server_manager_template: string, use_server_manager: boolean, disallowed_tools: string[], user_provided_prompt?: string, additional_instructions?: string }): SystemMessage {
    logger.warn('Using placeholder createSystemMessage function.');
    let template = options.use_server_manager ? options.server_manager_template : options.system_prompt_template;
    if (options.user_provided_prompt) {
        template = options.user_provided_prompt; // Override with full user prompt
    }

    const toolDescriptions = options.tools
        .filter(tool => !options.disallowed_tools.includes(tool.name))
        .map(tool => `${tool.name}: ${tool.description}`)
        .join('\n');

    let content = template.replace('{tool_descriptions}', toolDescriptions);
    if (options.additional_instructions) {
        content += `\n\n${options.additional_instructions}`;
    }
    return new SystemMessage(content);
}


export interface MCPAgentOptions {
  llm: BaseLanguageModel;
  client?: MCPClient;
  connectors?: BaseConnector[];
  serverName?: string; // Relevant if client is provided
  maxSteps?: number;
  autoInitialize?: boolean;
  memoryEnabled?: boolean;
  systemPrompt?: string; // Full override
  systemPromptTemplate?: string; // Template override
  additionalInstructions?: string;
  disallowedTools?: string[];
  useServerManager?: boolean;
  verbose?: boolean;
}

export class MCPAgent {
  private llm: BaseLanguageModel;
  private client?: MCPClient;
  private connectors: BaseConnector[];
  private serverName?: string;
  private maxSteps: number;
  private autoInitialize: boolean;
  private memoryEnabled: boolean;
  private initialized: boolean = false;
  private conversationHistory: BaseMessage[] = [];
  private disallowedTools: string[];
  private useServerManager: boolean;
  private verbose: boolean;

  private systemPrompt?: string;
  private systemPromptTemplateOverride?: string;
  private additionalInstructions?: string;

  private adapter: LangChainAdapter;
  private serverManager?: ServerManager;
  private agentExecutor?: AgentExecutor;
  private sessions: Record<string, MCPSession> = {};
  private systemMessage?: SystemMessage;
  private tools: StructuredTool[] = [];

  constructor(options: MCPAgentOptions) {
    this.llm = options.llm;
    this.client = options.client;
    this.connectors = options.connectors || [];
    this.serverName = options.serverName;
    this.maxSteps = options.maxSteps ?? 5;
    this.autoInitialize = options.autoInitialize ?? true;
    this.memoryEnabled = options.memoryEnabled ?? true;
    this.disallowedTools = options.disallowedTools || [];
    this.useServerManager = options.useServerManager ?? false;
    this.verbose = options.verbose ?? false;

    this.systemPrompt = options.systemPrompt;
    this.systemPromptTemplateOverride = options.systemPromptTemplate;
    this.additionalInstructions = options.additionalInstructions;

    if (!this.client && this.connectors.length === 0) {
      throw new Error('Either client or connectors must be provided');
    }

    this.adapter = new LangChainAdapter(this.disallowedTools);

    if (this.useServerManager) {
      if (!this.client) {
        throw new Error('Client must be provided when using server manager');
      }
      this.serverManager = new ServerManager(this.client, this.adapter);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.info('Agent already initialized.');
      return;
    }
    logger.info('🚀 Initializing MCP agent...');

    if (this.useServerManager && this.serverManager) {
      await this.serverManager.initialize();
      this.tools = await this.serverManager.getServerManagementTools();
      logger.info(`🔧 Server manager mode active with ${this.tools.length} management tools`);
      await this.createSystemMessageFromTools(this.tools);
    } else {
      let connectorsToUse: BaseConnector[] = [];
      if (this.client) {
        this.sessions = this.client.getAllActiveSessions();
        logger.info(`🔌 Found ${Object.keys(this.sessions).length} existing sessions`);
        if (Object.keys(this.sessions).length === 0) {
          logger.info('🔄 No active sessions found, creating new ones...');
          // Create session for specific server or all servers
          if (this.serverName) {
            await this.client.createSession(this.serverName, true);
          } else {
            await this.client.createAllSessions(true);
          }
          this.sessions = this.client.getAllActiveSessions();
          logger.info(`✅ Created/found ${Object.keys(this.sessions).length} sessions`);
        }
        connectorsToUse = Object.values(this.sessions).map(s => s.connector);
      } else {
        connectorsToUse = this.connectors;
        logger.info(`🔗 Connecting to ${connectorsToUse.length} direct connectors...`);
        // Ensure connectors are connected (MCPSession might handle this)
        for (const connector of connectorsToUse) {
            // Assuming connect is idempotent or handled by session
            await connector.connect();
        }
      }

      // Load tools using the adapter (adapter handles connector initialization if needed)
      this.tools = await this.adapter.createLangchainTools(connectorsToUse);
      logger.info(`🛠️ Created ${this.tools.length} LangChain tools`);
      await this.createSystemMessageFromTools(this.tools);
    }

    this.agentExecutor = this.createAgent();
    this.initialized = true;
    logger.info('✨ Agent initialization complete');
  }

  private async createSystemMessageFromTools(tools: StructuredTool[]): Promise<void> {
    const defaultTemplate = this.systemPromptTemplateOverride || DEFAULT_SYSTEM_PROMPT_TEMPLATE;
    const serverTemplate = SERVER_MANAGER_SYSTEM_PROMPT_TEMPLATE; // Use imported/defined template

    this.systemMessage = createSystemMessage({
        tools: tools,
        system_prompt_template: defaultTemplate,
        server_manager_template: serverTemplate,
        use_server_manager: this.useServerManager,
        disallowed_tools: this.disallowedTools,
        user_provided_prompt: this.systemPrompt,
        additional_instructions: this.additionalInstructions,
    });

    if (this.memoryEnabled) {
        const historyWithoutSystem = this.conversationHistory.filter(msg => !(msg instanceof SystemMessage));
        this.conversationHistory = [this.systemMessage, ...historyWithoutSystem];
    }
  }

  private createAgent(): AgentExecutor {
    logger.debug(`Creating new agent with ${this.tools.length} tools`);

    const systemContent = this.systemMessage ? this.systemMessage.content : 'You are a helpful assistant.';

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemContent],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad'),
    ]);

    const agent = createToolCallingAgent({
        llm: this.llm,
        tools: this.tools,
        prompt,
    });

    return new AgentExecutor({
        agent,
        tools: this.tools,
        maxIterations: this.maxSteps,
        verbose: this.verbose,
        returnIntermediateSteps: true, // Important for seeing agent steps
        handleParsingErrors: (e: Error | OutputParserException) => {
            logger.error(`Agent output parsing error: ${e.message}`);
            // Provide feedback to the LLM about the parsing error
            return `Parsing Error: ${e.message}. Please check your output format.`;
        },
    });
  }

  /**
   * Run a query using the MCP tools.
   * 
   * @param query The query to run
   * @param max_steps Optional maximum number of steps to take
   * @param manage_connector Whether to handle the connector lifecycle internally
   * @param external_history Optional external conversation history to use instead of the internal history
   * @returns The result of running the query
   */
  async run(query: string, 
    max_steps?: number, 
    manage_connector: boolean = true, 
    external_history?: BaseMessage[]): Promise<Record<string, any>> {
    let initializedHere = false;
    
    try {
      // Initialize if needed
      if (manage_connector && !this.initialized) {
        await this.initialize();
        initializedHere = true;
      } else if (!this.initialized && this.autoInitialize) {
        await this.initialize();
        initializedHere = true;
      }
    }catch (err){
      throw new Error(`Initialization might have failed. ${err}` );
    }

    // if(1==1){
    //   return [];
    // }

    if (!this.agentExecutor) {
        throw new Error('AgentExecutor not created. Initialization might have failed.');
    }
    
    // Set max steps if provided
    const steps = max_steps !== undefined ? max_steps : this.maxSteps;
    if (this.agentExecutor) {
        this.agentExecutor.maxIterations = steps;
    }

    logger.info(`🏃 Running agent with query: "${query}"`);

    // Use external history if provided, otherwise use internal conversation history
    const historyToUse = external_history !== undefined ? external_history : this.conversationHistory;
    const currentHistory = this.memoryEnabled ? historyToUse : (this.systemMessage ? [this.systemMessage] : []);

    try {
        const result = await this.agentExecutor.invoke({
            input: query,
            chat_history: currentHistory,
        });

        logger.info(`🏁 Agent finished. Output: ${result.output}`);

        // Update history if memory is enabled
        if (this.memoryEnabled) {
            this.conversationHistory.push(new HumanMessage(query));
            // Assuming result.output is the AI's final response
            this.conversationHistory.push(new AIMessage(result.output));
            // Potentially trim history if it gets too long
        }

        // Handle server manager tool updates if necessary
        if (this.useServerManager && result.intermediateSteps) {
            await this.updateToolsAfterStep(result.intermediateSteps);
        }

        return result;
    } catch (error) {
        logger.error(`Agent execution failed: ${error}`);
        throw error;
    } finally {
        // Clean up if necessary (e.g., if not using client-managed sessions)
        if (manage_connector && !this.client && initializedHere) {
            logger.info('🧹 Closing agent after query completion');
            // Add a close method if needed
            // await this.close();
        }
    }
  }

  // Helper to update tools if server manager connects/disconnects
  private async updateToolsAfterStep(intermediateSteps: Array<{ action: any; observation: string }>): Promise<void> {
      if (!this.useServerManager || !this.serverManager) return;

      let serverChanged = false;
      for (const step of intermediateSteps) {
          const action = step.action as any; // Type assertion needed
          if (action.tool === 'connect_to_mcp_server' || action.tool === 'disconnect_from_mcp_server') {
              serverChanged = true;
              break;
          }
      }

      if (serverChanged) {
          logger.info('Server connection changed, updating available tools...');
          const managementTools = await this.serverManager.getServerManagementTools();
          const activeServerTools = this.serverManager.getActiveServerTools();
          this.tools = [...managementTools, ...activeServerTools];

          // Re-create system message and agent executor with new tools
          await this.createSystemMessageFromTools(this.tools);
          this.agentExecutor = this.createAgent();
          logger.info(`Agent tools updated. Total tools: ${this.tools.length}`);
      }
  }

  resetMemory(): void {
    logger.info('🔄 Resetting conversation memory.');
    this.conversationHistory = this.systemMessage ? [this.systemMessage] : [];
  }

  getHistory(): BaseMessage[] {
    return this.conversationHistory;
  }

  // step method implementation would be more complex, involving manual agent invocation
  // and state management. For simplicity, focusing on run() for now.
  // async step(query: string, previousSteps?: Record<string, any>[]): Promise<Record<string, any>> {
  //   // ... implementation ...
  // }
}