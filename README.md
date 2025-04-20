
<h1 align="center">Unified MCP Client Library for TypeScript</h1>

<!-- [![npm Downloads](https://img.shields.io/npm/dw/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![npm Monthly Downloads](https://img.shields.io/npm/dm/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use) -->
[![npm Version](https://img.shields.io/npm/v/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![TypeScript Support](https://img.shields.io/npm/types/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
<!-- [![Documentation](https://img.shields.io/badge/docs-mcp--use--ts.io-blue)](https://easy-mcp-use.52kx.net) -->
[![License](https://img.shields.io/github/license/dforel/easy-mcp-use)](https://github.com/dforel/easy-mcp-use/blob/main/LICENSE)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io)
<!-- [![GitHub stars](https://img.shields.io/github/stars/pietrozullo/easy-mcp-use?style=social)](https://github.com/dforel/easy-mcp-use/stargazers) -->
<!-- [![Twitter Follow](https://img.shields.io/twitter/follow/Pietro?style=social)](https://x.com/pietrozullo) -->

🌐 Easy-MCP-Use is the open source TypeScript library to connect **any LLM to any MCP server** and build custom agents that have tool access, without using closed source or application clients.

💡 Let developers easily connect any LLM to tools like web browsing, file operations, and more with full TypeScript support.

# Features

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔄 **Ease of use** | Create your first MCP capable agent with just 6 lines of TypeScript code |
| 🤖 **LLM Flexibility** | Works with any LangChain supported LLM that supports tool calling (OpenAI, Anthropic, Groq, LLama etc.) |
| 🌐 **HTTP Support** | Direct connection to MCP servers running on specific HTTP ports |
| ⚙️ **Dynamic Server Selection** | TODO Agents can dynamically choose the most appropriate MCP server for a given task from the available pool |
| 🧩 **Multi-Server Support** | TODO Use multiple MCP servers simultaneously in a single agent |
| 🛡️ **Tool Restrictions** | TODO Restrict potentially dangerous tools like file system or network access |
| 📝 **Type Safety** | TODO Full TypeScript support with type definitions for all APIs and configurations |

# Quick start

With npm:

```bash
npm install easy-mcp-use
```

Or install from source:

```bash
git clone https://github.com/dforel/easy-mcp-use.git
cd easy-mcp-use
npm install
npm run build
```

### Installing LangChain Providers

easy-mcp-use works with various LLM providers through LangChain. You'll need to install the appropriate LangChain provider package for your chosen LLM. For example:

```bash
# For OpenAI
npm install @langchain/openai

# For Anthropic
npm install @langchain/anthropic

# For other providers, check the [LangChain chat models documentation](https://js.langchain.com/docs/integrations/chat/)
```

and add your API keys for the provider you want to use to your `.env` file.

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

> **Important**: Only models with tool calling capabilities can be used with easy-mcp-use. Make sure your chosen model supports function calling or tool use.

### Spin up your agent:

```typescript
import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { MCPAgent, MCPClient } from 'easy-mcp-use';

async function main() {
    // Load environment variables
    config();

    // Create configuration object
    const config = {
      mcpServers: {
        playwright: {
          command: 'npx',
          args: ['@playwright/mcp@latest'],
          env: {
            DISPLAY: ':1'
          }
        }
      }
    };

    // Create MCPClient from configuration object
    const client = MCPClient.fromConfig(config);

    // Create LLM
    const llm = new ChatOpenAI({ modelName: 'gpt-4' });

    // Create agent with the client
    const agent = new MCPAgent({
        llm,
        client,
        maxSteps: 30
    });

    try {
        // Run the query
        const result = await agent.run(
            'Find the best restaurant in San Francisco'
        );
        console.log('\nResult:', result);
    } finally {
        // Clean up resources
        await client.closeAllSessions();
    }
}

main().catch(console.error);
```

You can also add the servers configuration from a config file like this:

```typescript
const client = MCPClient.fromConfigFile(
    path.join(__dirname, 'browser_mcp.json')
);
```

Example configuration file (`browser_mcp.json`):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {
        "DISPLAY": ":1"
      }
    }
  }
}
```

For other settings, models, and more, check out the documentation.

# Example Use Cases

## Web Browsing with Playwright

```typescript
import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { MCPAgent, MCPClient } from 'easy-mcp-use';
import path from 'path';

async function main() {
    // Load environment variables
    config();

    // Create MCPClient from config file
    const client = MCPClient.fromConfigFile(
        path.join(__dirname, 'browser_mcp.json')
    );

    // Create LLM
    const llm = new ChatOpenAI({ modelName: 'gpt-4' });
    // Alternative models:
    // const llm = new ChatAnthropic({ modelName: 'claude-3-sonnet-20240229' });
    // const llm = new ChatGroq({ modelName: 'llama3-8b-8192' });

    // Create agent with the client
    const agent = new MCPAgent({
        llm,
        client,
        maxSteps: 30
    });

    try {
        // Run the query
        const result = await agent.run(
            'Find the best restaurant in San Francisco USING GOOGLE SEARCH',
            { maxSteps: 30 }
        );
        console.log('\nResult:', result);
    } finally {
        // Clean up resources
        await client.closeAllSessions();
    }
}

main().catch(console.error);
```

This example demonstrates how to connect to an MCP server running on a specific HTTP port. Make sure to start your MCP server before running this example.

# Multi-Server Support

MCP-Use-TS allows configuring and connecting to multiple MCP servers simultaneously using the `MCPClient`. This enables complex workflows that require tools from different servers, such as web browsing combined with file operations or 3D modeling.

## Configuration

You can configure multiple servers in your configuration file:

```json
{
  "mcpServers": {
    "airbnb": {
      "command": "npx",
      "args": ["-y", "@openbnb/mcp-server-airbnb", "--ignore-robots-txt"]
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"],
      "env": {
        "DISPLAY": ":1"
      }
    }
  }
}
```

## Usage

The `MCPClient` class provides methods for managing connections to multiple servers. When creating an `MCPAgent`, you can provide an `MCPClient` configured with multiple servers.

By default, the agent will have access to tools from all configured servers. If you need to target a specific server for a particular task, you can specify the `serverName` when calling the `agent.run()` method.

```typescript
// Example: Manually selecting a server for a specific task
const airbnbResult = await agent.run(
    'Search for Airbnb listings in Barcelona',
    { serverName: 'airbnb' } // Explicitly use the airbnb server
);

const googleResult = await agent.run(
    'Find restaurants near the first result using Google Search',
    { serverName: 'playwright' } // Explicitly use the playwright server
);
``` 

### Agent-Specific Verbosity

If you only want to see debug information from the agent without enabling full debug logging, you can set the `verbose` parameter when creating an MCPAgent:

```typescript
// Create agent with increased verbosity
const agent = new MCPAgent({
    llm,
    client,
    verbose: true  // Only shows debug messages from the agent
});
```

This is useful when you only need to see the agent's steps and decision-making process without all the low-level debug information from other components.

# Roadmap

<ul>
<li>[x] Multiple Servers at once </li>
<li>[x] Test remote connectors (http, ws)</li>
<li>[ ] ... </li>
</ul>



# Contributing

We love contributions! Feel free to open issues for bugs or feature requests.

# Requirements

- Node.js 18+
- TypeScript 5.0+
- MCP implementation (like Playwright MCP)
- LangChain and appropriate model libraries (OpenAI, Anthropic, etc.)

# Citation

If you use MCP-Use-TS in your research or project, please cite:

```bibtex
@software{mcp_use_ts,
  author = {dforel},
  title = {MCP-Use-TS: MCP Library for TypeScript},
  year = {2025},
  publisher = {GitHub},
  url = {https://github.com/dforel/easy-mcp-use}
}
```

### Other

this project is a fork of [mcp-use](https://github.com/mcp-use/mcp-use)

i hope you enjoy it

# License

MIT
