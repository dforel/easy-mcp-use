// Base agent interface for MCP tools in TypeScript

import { MCPSession } from '../session'; // Assuming MCPSession is defined

/**
 * Base class for agents that use MCP tools.
 *
 * This abstract class defines the interface for agents that use MCP tools.
 * Agents are responsible for integrating LLMs with MCP tools.
 */
export abstract class BaseAgent {
  protected session: MCPSession;

  /**
   * Initialize a new agent.
   *
   * @param session The MCP session to use for tool calls.
   */
  constructor(session: MCPSession) {
    this.session = session;
  }

  /**
   * Initialize the agent.
   *
   * This method should prepare the agent for use, including initializing
   * the MCP session and setting up any necessary components.
   */
  abstract initialize(): Promise<void>;

  /**
   * Run the agent with a query.
   *
   * @param query The query to run.
   * @param maxSteps The maximum number of steps to run.
   * @returns The final result from the agent.
   */
  abstract run(query: string, maxSteps?: number): Promise<Record<string, any>>;

  /**
   * Perform a single step of the agent.
   *
   * @param query The query to run.
   * @param previousSteps Optional list of previous steps.
   * @returns The result of the step.
   */
  abstract step(query: string, previousSteps?: Record<string, any>[]): Promise<Record<string, any>>;
}