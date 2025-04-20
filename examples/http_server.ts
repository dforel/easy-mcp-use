import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
const server = new McpServer({
  name: "exchange-sse",
  version: "1.0.0"
});
server.tool("exchange",
  '人民币汇率换算工具,有一个参数rmb,表示人民币的数量,返回内容是rmb人民币兑换成美元和港币的结果',
  { rmb: z.number() },
  async ({ rmb }) => {
    // 使用固定汇率进行演示，实际应该调用汇率API
    const usdRate = 0.14; // 1人民币约等于0.14美元
    const hkdRate = 1.09; // 1人民币约等于1.09港币
    
    const usd = (rmb * usdRate).toFixed(2);
    const hkd = (rmb * hkdRate).toFixed(2);
    
    return {
      content: [{ 
        type: "text", 
        text: `${rmb}人民币等于:\n${usd}美元\n${hkd}港币`
      }]
    }
  },
);
const app = express();
const sessions: Record<string, { transport: SSEServerTransport; response: express.Response }> = {}
app.get("/sse", async (req, res) => {
  console.log(`New SSE connection from ${req.ip}`);
  const sseTransport = new SSEServerTransport("/messages", res);
  const sessionId = sseTransport.sessionId;
  if (sessionId) {
    sessions[sessionId] = { transport: sseTransport, response: res }
  }
  await server.connect(sseTransport);
});
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const session = sessions[sessionId];
  if (!session) {
    res.status(404).send("Session not found");
    return;
  }
  await session.transport.handlePostMessage(req, res);
});
app.listen(3001);