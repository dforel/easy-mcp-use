import { MCPClient } from '../src/client';
import path from 'path';
import { MCPAgent, MCPAgentOptions } from '../src/agents/mcpagent';
// import { ChatOpenAI } from 'langchain/core/language_models/chat_openai';
// import { OpenAI } from "@langchain/llms/openai";
import { ChatOpenAI } from '@langchain/openai';
import { logger } from '../src/logging';
import dotenv from 'dotenv';
dotenv.config();

const openAIApiKey = process.env.openAIApiKey; 
if (!openAIApiKey) {
  throw new Error("openAIApiKey environment variable is not set");
}
logger.info(`openAIApiKey: ${openAIApiKey}`);

async function main() {
  // 从配置文件创建客户端
  const client = await MCPClient.fromConfigFile(
    path.resolve(__dirname, './browser_mcp.json')
  );

  try { 
    const chat = new ChatOpenAI(
      {
        modelName: 'google/gemini-2.0-flash-exp:free', 
        // modelName: 'google/gemini-2.5-pro-exp-03-25:free', 
        streaming: true,
        openAIApiKey: openAIApiKey,
        configuration: {
          baseURL: 'https://openrouter.ai/api/v1',  
        }
      }
    );
    let options: MCPAgentOptions = {
      client: client,
      verbose: true,
      maxSteps: 30, 
      llm:  chat,
    }
    let agent = new MCPAgent(options)

    let result = agent.run(
      `
      open bing.com
      click input
      input mcp-use-ts
      click search
      ` 
    );

     console.log( JSON.stringify(result) );
  } finally {
    console.info('finally');
  }
}

main().catch(console.error);