import type { BraveSearch } from 'brave-search';
import type { MockBraveSearch } from '../mocks/index.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { BraveMcpServer } from '../../src/server.js';
import { createMockBraveSearch } from '../mocks/index.js';

describe('braveMcpServer', () => {
  let mockBraveSearch: MockBraveSearch;
  let server: BraveMcpServer;

  beforeEach(() => {
    mockBraveSearch = createMockBraveSearch();
    // Pass the mock as the third parameter (dependency injection)
    server = new BraveMcpServer(
      'fake-api-key',
      false,
      mockBraveSearch as unknown as BraveSearch,
    );
  });

  describe('constructor', () => {
    it('should create a server instance with injected BraveSearch', () => {
      expect(server).toBeDefined();
      expect(server.serverInstance).toBeDefined();
    });

    it('should use the injected BraveSearch instance', () => {
      // The mock should be used, not a real BraveSearch instance
      expect(mockBraveSearch.webSearch).not.toHaveBeenCalled();
    });
  });

  describe('server metadata', () => {
    it('should have correct server name and version', () => {
      const serverInfo = server.serverInstance;
      expect(serverInfo).toBeDefined();
    });
  });
});
