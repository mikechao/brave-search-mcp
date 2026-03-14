import { MCPClientManager } from '@mcpjam/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_TOOL_NAMES, TOOL_NAMES } from '../../src/tool-names.js';

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
  const expectedToolNames = ALL_TOOL_NAMES;

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
    it('should have all 6 tools registered', async () => {
      const tools = await manager.listTools(serverName);
      const toolNames = tools.tools.map(t => t.name);

      expect(toolNames).toEqual(expect.arrayContaining(expectedToolNames));
      expect(tools.tools).toHaveLength(expectedToolNames.length);
    });
  });

  describe('tool execution with mocks', () => {
    it(`${TOOL_NAMES.web} should return mocked results`, async () => {
      const result = await manager.executeTool(serverName, TOOL_NAMES.web, {
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

    it(`${TOOL_NAMES.image} should return mocked results`, async () => {
      const result = await manager.executeTool(serverName, TOOL_NAMES.image, {
        query: 'test image',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
    }, 30000);

    it(`${TOOL_NAMES.news} should return mocked results`, async () => {
      const result = await manager.executeTool(serverName, TOOL_NAMES.news, {
        query: 'test news',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
    }, 30000);

    it(`${TOOL_NAMES.video} should return mocked results`, async () => {
      const result = await manager.executeTool(serverName, TOOL_NAMES.video, {
        query: 'test video',
        count: 3,
      });

      expect(result).toBeDefined();
      expect('content' in result).toBe(true);
    }, 30000);
  });
});
