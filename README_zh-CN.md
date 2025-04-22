[简体中文](README_zh-CN.md)|[English](/README.md)

<h1 align="center">统一的 TypeScript MCP 客户端库</h1>

[![npm Downloads](https://img.shields.io/npm/dw/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![npm Monthly Downloads](https://img.shields.io/npm/dm/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![npm Version](https://img.shields.io/npm/v/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![TypeScript Support](https://img.shields.io/npm/types/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![Documentation](https://img.shields.io/badge/docs-easy--mcp--use.52kx.net-blue)](https://easy-mcp-use.52kx.net)

[![License](https://img.shields.io/github/license/dforel/easy-mcp-use)](https://github.com/dforel/easy-mcp-use/blob/main/LICENSE)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io)
[![GitHub stars](https://img.shields.io/github/stars/dforel/easy-mcp-use?style=social)](https://github.com/dforel/easy-mcp-use/stargazers)
[![Twitter Follow](https://img.shields.io/twitter/follow/dforel99?style=social)](https://x.com/dforel99)

🌐 Easy-MCP-Use 是一个开源的 TypeScript 库，用于将**任何 LLM 连接到任何 MCP 服务器**，并构建具有工具访问能力的自定义代理，无需使用闭源或应用程序客户端。

💡 让开发者能够轻松地将任何 LLM 连接到网页浏览、文件操作等工具，并提供完整的 TypeScript 支持。

# 特性

## ✨ 主要特性

| 特性 | 描述 |
|---------|-------------|
| 🔄 **易用性** | 仅需 6 行 TypeScript 代码即可创建您的第一个具有 MCP 功能的代理 |
| 🤖 **LLM 灵活性** | 适用于任何支持工具调用的 LangChain 支持的 LLM（如 OpenAI、Anthropic、Groq、LLama 等） |
| 🌐 **HTTP 支持** | 直接连接到运行在特定 HTTP 端口上的 MCP 服务器 |
| ⚙️ **动态服务器选择** | TODO 代理可以从可用池中动态选择最适合给定任务的 MCP 服务器 |
| 🧩 **多服务器支持** | TODO 在单个代理中同时使用多个 MCP 服务器 |
| 🛡️ **工具限制** | TODO 限制潜在危险的工具，如文件系统或网络访问 |
| 📝 **类型安全** | TODO 为所有 API 和配置提供完整的 TypeScript 支持和类型定义 |

# 快速开始

使用 npm 安装：

```bash
npm install easy-mcp-use
```

或从源代码安装：

```bash
git clone https://github.com/dforel/easy-mcp-use.git
cd easy-mcp-use
npm install
npm run build
```

### 安装 LangChain 提供程序

easy-mcp-use 通过 LangChain 与各种 LLM 提供商协同工作。您需要为您选择的 LLM 安装相应的 LangChain 提供程序包。例如：

```bash
# 对于 OpenAI
npm install @langchain/openai

# 对于 Anthropic
npm install @langchain/anthropic

# 对于其他提供商，请查看 [LangChain 聊天模型文档](https://js.langchain.com/docs/integrations/chat/)
```

并将您想要使用的提供商的 API 密钥添加到您的 `.env` 文件中。

```env
# 对于 OpenAI
OPENAI_API_KEY=

# 对于 Anthropic
ANTHROPIC_API_KEY=
```

> **重要提示**：只有具有工具调用功能的模型才能与 easy-mcp-use 一起使用。请确保您选择的模型支持函数调用或工具使用。

### 启动您的代理：

```typescript
import { MCPClient } from 'easy-mcp-use';
import { MCPAgent, MCPAgentOptions } from 'easy-mcp-use';
import { ChatOpenAI } from '@langchain/openai';
import dotenv from 'dotenv';
dotenv.config();
 

const openAIApiKey = process.env.openRouteApiKey; 

if (!openAIApiKey) {
  throw new Error("openAIApiKey environment variable is not set");
}
console.log(`openAIApiKey: ${openAIApiKey}`);

async function main() {
    

  let config = {"mcpServers": {"http": {"url": "http://localhost:3001/sse"}}}
  // 从配置文件创建客户端
  const client = MCPClient.fromConfig( config );

  try { 
    const chat = new ChatOpenAI(
      {
        modelName: 'google/gemini-2.0-flash-exp:free', 
        streaming: true,
        openAIApiKey: openAIApiKey,
        configuration: {
          baseURL: 'https://openrouter.ai/api/v1',  
        }
      }
    );
    let options = {
      client: client,
      // verbose: true,
      maxSteps: 30, 
      llm:  chat,
    }
    let agent = new MCPAgent(options)

    let result = agent.run(
      `
      100 rmb can exchange how much doller？
      ` 
    );

     console.log( JSON.stringify(result) );
  } finally {
    // console.info('finally');
  }
}

main().catch(console.error);
```

您也可以从配置文件中添加服务器配置，如下所示：

```typescript
const client = MCPClient.fromConfigFile(
    path.join(__dirname, 'browser_mcp.json')
);
```

配置文件示例（`browser_mcp.json`）：

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

有关其他设置、模型和更多信息，请查看文档。

# 示例用例

## HTTP 服务器示例

这里有一个示例项目：
[easy-mcp-use-example](https://github.com/dforel/easy-mcp-use-examples)
(https://github.com/dforel/easy-mcp-use-examples)

## 使用 Playwright 进行网页浏览

```typescript
import { MCPClient } from '../src/client';
import path from 'path';
import { MCPAgent, MCPAgentOptions } from '../src/agents/mcpagent';
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
      input easy-mcp-use
      click search
      ` 
    );

     console.log( JSON.stringify(result) );
  } finally {
    console.info('finally');
  }
}

main().catch(console.error);
```

此示例演示了如何连接到运行在特定 HTTP 端口上的 MCP 服务器。在运行此示例之前，请确保启动您的 MCP 服务器。

# 多服务器支持

MCP-Use-TS 允许使用 `MCPClient` 同时配置和连接多个 MCP 服务器。这使得复杂的工作流成为可能，例如将网页浏览与文件操作或 3D 建模结合使用。

## 配置

您可以在配置文件中配置多个服务器：

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

## 使用方法

`MCPClient` 类提供了管理多个服务器连接的方法。在创建 `MCPAgent` 时，您可以提供配置了多个服务器的 `MCPClient`。

默认情况下，代理将可以访问所有配置的服务器中的工具。如果您需要针对特定任务使用特定服务器，可以在调用 `agent.run()` 方法时指定 `serverName`。

```typescript
// 示例：手动选择特定任务的服务器
const airbnbResult = await agent.run(
    '搜索巴塞罗那的 Airbnb 房源',
    { serverName: 'airbnb' } // 显式使用 airbnb 服务器
);

const googleResult = await agent.run(
    '使用 Google 搜索第一个结果附近的餐厅',
    { serverName: 'playwright' } // 显式使用 playwright 服务器
);
``` 

### 代理特定的详细程度

如果您只想查看代理的调试信息而不启用完整的调试日志记录，可以在创建 MCPAgent 时设置 `verbose` 参数：

```typescript
// 创建具有增加详细程度的代理
const agent = new MCPAgent({
    llm,
    client,
    verbose: true  // 仅显示代理的调试消息
});
```

这在您只需要查看代理的步骤和决策过程而不需要查看其他组件的所有低级调试信息时很有用。

# 路线图

<ul>
<li>[x] 同时支持多个服务器 </li>
<li>[x] 测试远程连接器（http、ws）</li>
<li>[ ] ... </li>
</ul>

# 贡献

我们欢迎贡献！欢迎为错误或功能请求开启问题。

# 要求

- Node.js 18+
- TypeScript 5.0+
- MCP 实现（如 Playwright MCP）
- LangChain 和适当的模型库（OpenAI、Anthropic 等）

# 引用

如果您在研究或项目中使用 MCP-Use-TS，请引用：

```bibtex
@software{easy-mcp-use,
  author = {dforel},
  title = {Easy-MCP-Use: MCP Library for TypeScript},
  year = {2025},
  publisher = {GitHub},
  url = {https://github.com/dforel/easy-mcp-use}
}
```

### 其他

本项目是 [mcp-use](https://github.com/mcp-use/mcp-use) 的一个fork，感谢 [mcp-use](https://github.com/mcp-use/mcp-use) 项目的作者。

希望您喜欢使用它

# 许可证

MIT