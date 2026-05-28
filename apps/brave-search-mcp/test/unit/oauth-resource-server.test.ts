import type { JWK } from 'jose';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOAuthProtectedResourceMetadata,
  buildOAuthUnauthorizedHeaders,
  createOAuthIdentityResolver,
  OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
} from '../../src/auth/oauth-resource-server.js';
import { jwtFixtureJwks } from '../helpers/jwt-fixtures.js';
import {
  buildOAuthAuthorizationServerMetadata,
  buildOAuthIntrospectionResponse,
  createOAuthAccessToken,
  OAUTH_FIXTURE_AUDIENCE,
  OAUTH_FIXTURE_DISCOVERY_PATH,
  OAUTH_FIXTURE_INTROSPECTION_ENDPOINT,
  OAUTH_FIXTURE_ISSUER,
  OAUTH_FIXTURE_JWKS_PATH,
  OAUTH_FIXTURE_JWKS_URI,
  OAUTH_FIXTURE_OIDC_DISCOVERY_PATH,
  OAUTH_FIXTURE_SUBJECT,
} from '../helpers/oauth-fixtures.js';

describe('oauth resource server auth helper', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('loads authorization server metadata and JWKS at startup and maps token subject to caller identity', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`) {
        return jsonResponse(buildOAuthAuthorizationServerMetadata());
      }
      if (url === OAUTH_FIXTURE_JWKS_URI) {
        return jsonResponse(jwtFixtureJwks);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const resolveIdentity = await createOAuthIdentityResolver({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      verifyStrategy: 'jwks',
    });
    const token = await createOAuthAccessToken();

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toEqual({
      transport: 'http',
      authSource: 'oauth',
      callerId: OAUTH_FIXTURE_SUBJECT,
      scopes: ['search:read', 'tools:list'],
    });
  });

  it('refreshes JWKS when OAuth tokens reference a new kid', async () => {
    const nextKeyPair = await generateKeyPair('RS256');
    const nextPublicJwk = await exportJWK(nextKeyPair.publicKey) as JWK;
    const rotatedJwks = {
      keys: [
        {
          ...nextPublicJwk,
          alg: 'RS256',
          kid: 'rotated-rs256-key',
          use: 'sig',
        },
      ],
    };
    let jwksRequestCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`)
        return jsonResponse(buildOAuthAuthorizationServerMetadata());
      if (url === OAUTH_FIXTURE_JWKS_URI) {
        jwksRequestCount += 1;
        return jsonResponse(jwksRequestCount === 1 ? jwtFixtureJwks : rotatedJwks);
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const resolveIdentity = await createOAuthIdentityResolver({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      verifyStrategy: 'jwks',
    });
    const rotatedToken = await new SignJWT({ sub: OAUTH_FIXTURE_SUBJECT, scope: 'search:read tools:list' })
      .setProtectedHeader({ alg: 'RS256', kid: 'rotated-rs256-key' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setAudience(OAUTH_FIXTURE_AUDIENCE)
      .setIssuer(OAUTH_FIXTURE_ISSUER)
      .sign(nextKeyPair.privateKey);

    await expect(resolveIdentity(`Bearer ${rotatedToken}`)).resolves.toEqual({
      transport: 'http',
      authSource: 'oauth',
      callerId: OAUTH_FIXTURE_SUBJECT,
      scopes: ['search:read', 'tools:list'],
    });
    expect(jwksRequestCount).toBeGreaterThanOrEqual(2);
  });

  it('falls back to OpenID Connect discovery when OAuth authorization metadata is unavailable', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`)
        return jsonResponse({ error: 'not_found' }, 404);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_OIDC_DISCOVERY_PATH}`)
        return jsonResponse(buildOAuthAuthorizationServerMetadata());
      if (url === OAUTH_FIXTURE_JWKS_URI)
        return jsonResponse(jwtFixtureJwks);
      throw new Error(`Unexpected fetch ${url}`);
    });

    const resolveIdentity = await createOAuthIdentityResolver({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      verifyStrategy: 'jwks',
    });
    const token = await createOAuthAccessToken();

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toMatchObject({
      authSource: 'oauth',
      callerId: OAUTH_FIXTURE_SUBJECT,
    });
  });

  it('uses the OIDC path-based discovery URL for issuers with path components', async () => {
    const pathIssuer = `${OAUTH_FIXTURE_ISSUER}/realms/demo`;
    const pathJwksUri = `${pathIssuer}${OAUTH_FIXTURE_JWKS_PATH}`;

    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}/realms/demo`)
        return jsonResponse({ error: 'not_found' }, 404);
      if (url === `${pathIssuer}${OAUTH_FIXTURE_OIDC_DISCOVERY_PATH}`) {
        return jsonResponse(buildOAuthAuthorizationServerMetadata({
          issuer: pathIssuer,
          jwks_uri: pathJwksUri,
        }));
      }
      if (url === pathJwksUri)
        return jsonResponse(jwtFixtureJwks);
      throw new Error(`Unexpected fetch ${url}`);
    });

    const resolveIdentity = await createOAuthIdentityResolver({
      issuer: pathIssuer,
      audience: OAUTH_FIXTURE_AUDIENCE,
      verifyStrategy: 'jwks',
    });
    const token = await createOAuthAccessToken({ issuer: pathIssuer });

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toMatchObject({
      authSource: 'oauth',
      callerId: OAUTH_FIXTURE_SUBJECT,
    });
  });

  it('rejects JWKS tokens whose issuer does not match the configured OAuth issuer', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`)
        return jsonResponse(buildOAuthAuthorizationServerMetadata());
      if (url === OAUTH_FIXTURE_JWKS_URI)
        return jsonResponse(jwtFixtureJwks);
      throw new Error(`Unexpected fetch ${url}`);
    });

    const resolveIdentity = await createOAuthIdentityResolver({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      verifyStrategy: 'jwks',
    });
    const wrongIssuerToken = await createOAuthAccessToken({
      issuer: 'http://127.0.0.1:4999',
    });

    await expect(resolveIdentity(`Bearer ${wrongIssuerToken}`)).resolves.toBeUndefined();
  });

  it('supports RFC 7662 introspection with client authentication', async () => {
    const token = await createOAuthAccessToken();
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`) {
        return jsonResponse(buildOAuthAuthorizationServerMetadata({
          introspection_endpoint: OAUTH_FIXTURE_INTROSPECTION_ENDPOINT,
          introspection_endpoint_auth_methods_supported: ['client_secret_basic'],
        }));
      }
      if (url === OAUTH_FIXTURE_INTROSPECTION_ENDPOINT) {
        expect(init?.method).toBe('POST');
        expect((init?.headers as Record<string, string>).authorization).toMatch(/^Basic /);
        expect(init?.body).toBe(`token=${encodeURIComponent(token)}&token_type_hint=access_token`);
        return jsonResponse(buildOAuthIntrospectionResponse());
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    const resolveIdentity = await createOAuthIdentityResolver({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      clientId: 'client-123',
      clientSecret: 'secret-abc',
      verifyStrategy: 'introspect',
    });

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toEqual({
      transport: 'http',
      authSource: 'oauth',
      callerId: OAUTH_FIXTURE_SUBJECT,
      scopes: ['search:read', 'tools:list'],
    });
  });

  it('fails startup when introspection metadata advertises only unsupported client auth methods', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`) {
        return jsonResponse(buildOAuthAuthorizationServerMetadata({
          introspection_endpoint: OAUTH_FIXTURE_INTROSPECTION_ENDPOINT,
          introspection_endpoint_auth_methods_supported: ['private_key_jwt'],
        }));
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    await expect(createOAuthIdentityResolver({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      clientId: 'client-123',
      clientSecret: 'secret-abc',
      verifyStrategy: 'introspect',
    })).rejects.toThrow(
      'OAuth auth startup error: unsupported introspection auth methods ["private_key_jwt"]; supported methods are "client_secret_basic" and "client_secret_post"',
    );
  });

  it('rejects inactive or wrong-audience introspection responses', async () => {
    const token = await createOAuthAccessToken();
    const responses = [
      buildOAuthIntrospectionResponse({ active: false }),
      buildOAuthIntrospectionResponse({ audience: 'different-audience' }),
    ];
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = toUrlString(input);
      if (url === `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_DISCOVERY_PATH}`) {
        return jsonResponse(buildOAuthAuthorizationServerMetadata({
          introspection_endpoint: OAUTH_FIXTURE_INTROSPECTION_ENDPOINT,
        }));
      }
      if (url === OAUTH_FIXTURE_INTROSPECTION_ENDPOINT)
        return jsonResponse(responses.shift() ?? buildOAuthIntrospectionResponse({ active: false }));
      throw new Error(`Unexpected fetch ${url}`);
    });

    const resolveIdentity = await createOAuthIdentityResolver({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      clientId: 'client-123',
      clientSecret: 'secret-abc',
      verifyStrategy: 'introspect',
    });

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toBeUndefined();
    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toBeUndefined();
  });

  it('builds protected resource metadata and bearer challenges from the request URL', () => {
    expect(buildOAuthProtectedResourceMetadata('http://localhost:3001/mcp', {
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      verifyStrategy: 'jwks',
    })).toEqual({
      resource: 'http://localhost:3001/mcp',
      authorization_servers: [OAUTH_FIXTURE_ISSUER],
      bearer_methods_supported: ['header'],
    });

    expect(buildOAuthUnauthorizedHeaders('http://localhost:3001/mcp')).toEqual({
      'content-type': 'application/json',
      'www-authenticate': `Bearer realm="brave-search-mcp", resource_metadata="http://localhost:3001${OAUTH_PROTECTED_RESOURCE_METADATA_PATH}"`,
    });
  });
});

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function toUrlString(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString();
}
