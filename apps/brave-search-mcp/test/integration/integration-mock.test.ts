import { MCPClientManager } from '@mcpjam/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Integration tests for Brave Search MCP Server using MockBraveSearch.
 *
 * These tests spawn the test server (with mocked BraveSearch) and verify
 * that tool execution returns the expected mock responses.
 *
 * Run `pnpm build:test-server` before running these tests.
 */
describe('brave search mcp server integration (mocked)', () => {
  let manager: MCPClientManager;
  const serverName = 'brave-search-mock';

  beforeAll(async () => {
    manager = new MCPClientManager();
    await manager.connectToServer(serverName, {
      command: 'node',
      args: ['.test-build/test-server.js'],
    });
  }, 30000);

  afterAll(async () => {
    await manager.disconnectServer(serverName);
  });

  describe('tool registration', () => {
    it('should have all 5 tools registered', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);

      expect(toolNames).toContain('brave_web_search');
      expect(toolNames).toContain('brave_image_search');
      expect(toolNames).toContain('brave_news_search');
      expect(toolNames).toContain('brave_video_search');
      expect(toolNames).toContain('brave_local_search');
      expect(tools.tools).toHaveLength(5);
    });
  });

  describe('tool execution with mocks', () => {
    it('brave_web_search should return mocked results', async () => {
      const result = await manager.executeTool(serverName, 'brave_web_search', {
        query: 'test query',
        count: 3,
      });

      // Result should have content from mock
      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
      if ('content' in result) {
        const content = result.content as { type: string }[];
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
        // Should be text content
        expect(content[0].type).toBe('text');
      }
    }, 30000);

    it('brave_image_search should return mocked results', async () => {
      const result = await manager.executeTool(serverName, 'brave_image_search', {
        query: 'test image',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
    }, 30000);

    it('brave_news_search should return mocked results', async () => {
      const result = await manager.executeTool(serverName, 'brave_news_search', {
        query: 'test news',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
    }, 30000);

    it('brave_video_search should return mocked results', async () => {
      const result = await manager.executeTool(serverName, 'brave_video_search', {
        query: 'test video',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
    }, 30000);
  });
});
