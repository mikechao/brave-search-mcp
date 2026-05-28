import { describe, expect, it } from 'vitest';
import { resolveAuthenticatedHttpIdentity } from '../../src/auth/http-api-key.js';

describe('http-api-key auth helper', () => {
  it('returns hashed caller identity for the configured bearer token', () => {
    expect(resolveAuthenticatedHttpIdentity('secret-key', 'Bearer secret-key')).toEqual({
      transport: 'http',
      authSource: 'http-api-key',
      callerId: '85dbe15d75ef9308c7ae0f33c7a324cc6f4bf519a2ed2f3027bd33c140a4f9aa',
    });
  });

  it.each([
    undefined,
    '',
    'Bearer ',
    'Basic secret-key',
    'Bearer wrong-key',
    'Bearer short',
    'bearer secret-key',
  ])('rejects malformed or incorrect authorization header %j', (authorizationHeader) => {
    expect(resolveAuthenticatedHttpIdentity('secret-key', authorizationHeader)).toBeUndefined();
  });
});
