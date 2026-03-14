import { MCPClientManager } from '@mcpjam/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration tests for Brave Search MCP Server using MCPJam SDK.
 *
 * These tests spawn the actual server and test tool registration and execution.
 * Note: Tests that call tools will make real API requests unless mocked at server level.
 *
 * To run with a real API key, set BRAVE_API_KEY environment variable.
 * Without an API key, only tool registration tests will pass.
 */
describe('brave search mcp server integration', () => {
  let manager: MCPClientManager;
  const serverName = 'brave-search';
  const expectedToolNames = [
    'brave_web_search',
    'brave_image_search',
    'brave_news_search',
    'brave_video_search',
    'brave_local_search',
    'brave_llm_context_search',
  ];

  beforeAll(async () => {
    manager = new MCPClientManager();
    await manager.connectToServer(serverName, {
      command: 'node',
      args: ['dist/index.js'],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || 'test-api-key',
      },
    });
  }, 30000); // 30s timeout for server startup

  afterAll(async () => {
    await manager.disconnectServer(serverName);
  });

  describe('tool registration', () => {
    it('should have brave_web_search tool', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);
      expect(toolNames).toContain('brave_web_search');
    });

    it('should have brave_image_search tool', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);
      expect(toolNames).toContain('brave_image_search');
    });

    it('should have brave_news_search tool', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);
      expect(toolNames).toContain('brave_news_search');
    });

    it('should have brave_video_search tool', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);
      expect(toolNames).toContain('brave_video_search');
    });

    it('should have brave_local_search tool', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);
      expect(toolNames).toContain('brave_local_search');
    });

    it('should have brave_llm_context_search tool', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);
      expect(toolNames).toContain('brave_llm_context_search');
    });

    it('should have exactly 6 tools registered', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);

      expect(toolNames).toEqual(expect.arrayContaining(expectedToolNames));
      expect(tools.tools).toHaveLength(expectedToolNames.length);
    });
  });

  describe('tool metadata', () => {
    it('brave_web_search should have correct description', async () => {
      const tools = await manager.listTools(serverName);
      const webSearchTool = tools.tools.find(t => t.name === 'brave_web_search');
      expect(webSearchTool).toBeDefined();
      expect(webSearchTool?.description).toContain('web');
    });

    it('tools should have inputSchema defined', async () => {
      const tools = await manager.listTools(serverName);
      for (const tool of tools.tools) {
        expect(tool.inputSchema).toBeDefined();
      }
    });
  });

  // Skip API tests when no real API key is provided
  describe.skipIf(!process.env.BRAVE_API_KEY)('tool execution (requires BRAVE_API_KEY)', () => {
    it('brave_web_search should return results for a query', async () => {
      const result = await manager.executeTool(serverName, 'brave_web_search', {
        query: 'vitest testing framework',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
      if ('content' in result) {
        const content = result.content as { type: string }[];
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
        expect(content[0].type).toBe('text');
      }
    }, 30000);

    it('brave_image_search should return results for a query', async () => {
      const result = await manager.executeTool(serverName, 'brave_image_search', {
        query: 'cats',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
      if ('content' in result) {
        const content = result.content as unknown[];
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
      }
    }, 30000);
  });
});
