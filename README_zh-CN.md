<div align="center">
[English](./README.md) | 简体中文
</div>

<h1 align="center">统一的 TypeScript MCP 客户端库</h1>

[![npm Downloads](https://img.shields.io/npm/dw/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![npm Monthly Downloads](https://img.shields.io/npm/dm/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![npm Version](https://img.shields.io/npm/v/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![TypeScript Support](https://img.shields.io/npm/types/easy-mcp-use.svg)](https://www.npmjs.com/package/easy-mcp-use)
[![Documentation](https://img.shields.io/badge/docs-easy--mcp--use.52kx.net-blue)](https://easy-mcp-use.52kx.net)
[![License](https://img.shields.io/github/license/dforel/easy-mcp-use)](https://github.com/dforel/easy-mcp-use/blob/main/LICENSE)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io)


# 特性

- 🚀 简单易用的 API 设计
- 🔌 支持多种连接方式（STDIO、HTTP）
- 🛠 灵活的工具集成
- 🔄 异步操作支持
- 📝 完整的类型定义
- 🔒 安全的错误处理
- 📚 详尽的文档

# 快速开始

使用 npm 安装：

```bash
npm install easy-mcp-use

```

或从源码安装：

```bash
git clone https://github.com/dforel/easy-mcp-use.git
cd easy-mcp-use
npm install
npm run build

```

### 安装 LangChain 提供商
easy-mcp-use 通过 LangChain 支持多种 LLM 提供商。您需要安装相应的 LangChain 提供商包：

```bash
npm install @langchain/openai

# Anthropic
npm install @langchain/anthropic

# 其他提供商请查看 LangChain 聊天模型文档

```

在 .env 文件中添加您选择的提供商的 API 密钥：

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

重要提示 ：只有支持工具调用功能的模型才能与 easy-mcp-use 一起使用。请确保您选择的模型支持函数调用或工具使用。

# 基本用法

```typescript
import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { MCPAgent, MCPClient } from 'easy-mcp-use';

// 加载环境变量
config();

async function main() {
  // 创建 LLM 实例
  const llm = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0
  });

  // 创建 MCP 客户端
  const client = await MCPClient.fromConfigFile("config.json");

  // 创建代理
  const agent = new MCPAgent({
    llm,
    client,
    verbose: true
  });

  // 运行代理
  const result = await agent.run({
    query: "请帮我打开浏览器并访问 example.com"
  });

  console.log("执行结果:", result);
}

main().catch(console.error);

```

# 系统要求
- Node.js 18+
- TypeScript 5.0+
- MCP 实现（如 Playwright MCP）
- LangChain 和相应的模型库（OpenAI、Anthropic 等）

文档

访问我们的 [在线文档](https://easy-mcp-use.52kx.net/) 获取完整的 API 参考和使用指南。

贡献

欢迎提交 Pull Requests！请确保遵循以下步骤：

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 更新测试
5. 提交 PR

# 许可证

本项目采用 MIT 许可证 - 查看 LICENSE 文件了解详情

# 引用
本项目是 [mcp-use](https://github/mcp-use/mcp-use) 的一个分支。

希望您能喜欢使用它
