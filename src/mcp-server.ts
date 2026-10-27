/**
 * Resume RAG — MCP Server entry point
 *
 * Starts the MCP server using stdio transport so that AI agents
 * (Kiro, VS Code, Claude Desktop, etc.) can connect to it.
 *
 * This process is separate from the Express API server (src/server.ts).
 * Both can run independently. The MCP server calls the same MongoDB
 * database and the same existing services — no data is duplicated.
 *
 * Usage:
 *   npx ts-node src/mcp-server.ts          (development)
 *   node dist/mcp-server.js                (production after build)
 *
 * Kiro / VS Code mcp.json config:
 *   {
 *     "mcpServers": {
 *       "resume-rag": {
 *         "command": "node",
 *         "args": ["dist/mcp-server.js"],
 *         "cwd": "/absolute/path/to/RAG-Resume",
 *         "env": {
 *           "MONGODB_URI": "...",
 *           "MISTRAL_API_KEY": "...", // embeddings
 *           "GROQ_API_KEY": "..." // chat/LLM
 *         }
 *       }
 *     }
 *   }
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createResumeMcpServer } from "./modules/mcp/server/resumeMcpServer";

async function main(): Promise<void> {
  const server = createResumeMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // MCP servers communicate over stdio — log to stderr only,
  // never to stdout (stdout is reserved for the JSON-RPC protocol).
  process.stderr.write("[resume-rag-mcp] MCP server started — listening on stdio\n");
}

main().catch((error) => {
  process.stderr.write(`[resume-rag-mcp] Fatal error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
