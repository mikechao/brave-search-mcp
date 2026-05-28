import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { createJwtFixtureToken, JWT_FIXTURE_AUDIENCE, jwtFixtureJwks } from './jwt-fixtures.js';

export const OAUTH_FIXTURE_HOST = '127.0.0.1';
export const OAUTH_FIXTURE_PORT = 4020;
export const OAUTH_FIXTURE_ISSUER = `http://${OAUTH_FIXTURE_HOST}:${OAUTH_FIXTURE_PORT}`;
export const OAUTH_FIXTURE_AUDIENCE = JWT_FIXTURE_AUDIENCE;
export const OAUTH_FIXTURE_SUBJECT = 'oauth-tenant-7';
export const OAUTH_FIXTURE_SCOPES = ['search:read', 'tools:list'];
export const OAUTH_FIXTURE_DISCOVERY_PATH = '/.well-known/oauth-authorization-server';
export const OAUTH_FIXTURE_OIDC_DISCOVERY_PATH = '/.well-known/openid-configuration';
export const OAUTH_FIXTURE_JWKS_PATH = '/.well-known/jwks.json';
export const OAUTH_FIXTURE_INTROSPECTION_PATH = '/oauth/introspect';
export const OAUTH_FIXTURE_JWKS_URI = `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_JWKS_PATH}`;
export const OAUTH_FIXTURE_INTROSPECTION_ENDPOINT = `${OAUTH_FIXTURE_ISSUER}${OAUTH_FIXTURE_INTROSPECTION_PATH}`;

interface CreateOAuthFixtureTokenOptions {
  audience?: string;
  issuer?: string;
  scope?: string | string[];
  subject?: string | null;
}

interface BuildOAuthMetadataOverrides {
  introspection_endpoint?: string;
  introspection_endpoint_auth_methods_supported?: string[];
  issuer?: string;
  jwks_uri?: string;
}

interface BuildOAuthIntrospectionResponseOptions {
  active?: boolean;
  audience?: string | string[];
  exp?: number;
  nbf?: number;
  scope?: string | string[];
  subject?: string | null;
  tokenType?: string;
}

interface StartOAuthProviderStubOptions {
  discoveryMode?: 'oauth' | 'oidc-only';
  expectedClientId?: string;
  expectedClientSecret?: string;
  host?: string;
  introspectionResponses?: Record<string, Record<string, unknown>>;
  port?: number;
}

export async function createOAuthAccessToken(
  options: CreateOAuthFixtureTokenOptions = {},
): Promise<string> {
  return createJwtFixtureToken({
    subject: options.subject === undefined ? OAUTH_FIXTURE_SUBJECT : options.subject,
    audience: options.audience ?? OAUTH_FIXTURE_AUDIENCE,
    issuer: options.issuer ?? OAUTH_FIXTURE_ISSUER,
    scope: options.scope ?? OAUTH_FIXTURE_SCOPES.join(' '),
  });
}

export function buildOAuthAuthorizationServerMetadata(
  overrides: BuildOAuthMetadataOverrides = {},
): Record<string, unknown> {
  return {
    issuer: overrides.issuer ?? OAUTH_FIXTURE_ISSUER,
    jwks_uri: overrides.jwks_uri ?? OAUTH_FIXTURE_JWKS_URI,
    introspection_endpoint: overrides.introspection_endpoint ?? OAUTH_FIXTURE_INTROSPECTION_ENDPOINT,
    introspection_endpoint_auth_methods_supported: overrides.introspection_endpoint_auth_methods_supported
      ?? ['client_secret_basic', 'client_secret_post'],
  };
}

export function buildOAuthIntrospectionResponse(
  options: BuildOAuthIntrospectionResponseOptions = {},
): Record<string, unknown> {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const scope = options.scope ?? OAUTH_FIXTURE_SCOPES.join(' ');
  const subject = options.subject === undefined ? OAUTH_FIXTURE_SUBJECT : options.subject;

  return {
    active: options.active ?? true,
    aud: options.audience ?? OAUTH_FIXTURE_AUDIENCE,
    exp: options.exp ?? nowInSeconds + 300,
    ...(options.nbf !== undefined ? { nbf: options.nbf } : {}),
    ...(subject ? { sub: subject } : {}),
    ...(scope !== undefined ? { scope } : {}),
    token_type: options.tokenType ?? 'Bearer',
  };
}

export async function startOAuthProviderStub(options: StartOAuthProviderStubOptions = {}) {
  const host = options.host ?? OAUTH_FIXTURE_HOST;
  const port = options.port ?? OAUTH_FIXTURE_PORT;
  const expectedClientId = options.expectedClientId;
  const expectedClientSecret = options.expectedClientSecret;
  const introspectionResponses = options.introspectionResponses ?? {};
  const discoveryMode = options.discoveryMode ?? 'oauth';
  let issuerBase = `http://${host}:${port}`;

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (
      requestUrl.pathname === OAUTH_FIXTURE_DISCOVERY_PATH
      || (discoveryMode === 'oidc-only' && requestUrl.pathname === OAUTH_FIXTURE_OIDC_DISCOVERY_PATH)
    ) {
      if (discoveryMode === 'oidc-only' && requestUrl.pathname === OAUTH_FIXTURE_DISCOVERY_PATH) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(buildOAuthAuthorizationServerMetadata({
        issuer: issuerBase,
        jwks_uri: `${issuerBase}${OAUTH_FIXTURE_JWKS_PATH}`,
        introspection_endpoint: `${issuerBase}${OAUTH_FIXTURE_INTROSPECTION_PATH}`,
      })));
      return;
    }

    if (requestUrl.pathname === OAUTH_FIXTURE_OIDC_DISCOVERY_PATH && discoveryMode === 'oauth') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    if (requestUrl.pathname === OAUTH_FIXTURE_JWKS_PATH) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(jwtFixtureJwks));
      return;
    }

    if (requestUrl.pathname === OAUTH_FIXTURE_INTROSPECTION_PATH && req.method === 'POST') {
      const body = await readRequestBody(req);
      const params = new URLSearchParams(body);

      if (!hasValidClientAuthentication(req.headers.authorization, params, expectedClientId, expectedClientSecret)) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_client' }));
        return;
      }

      const token = params.get('token') ?? '';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(introspectionResponses[token] ?? { active: false }));
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  issuerBase = `http://${address.address}:${address.port}`;
  return {
    issuer: issuerBase,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
      });
    },
  };
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
}

function hasValidClientAuthentication(
  authorizationHeader: string | undefined,
  params: URLSearchParams,
  expectedClientId: string | undefined,
  expectedClientSecret: string | undefined,
): boolean {
  if (!expectedClientId && !expectedClientSecret)
    return true;

  if (authorizationHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorizationHeader.slice('Basic '.length), 'base64').toString('utf-8');
    return decoded === `${expectedClientId}:${expectedClientSecret}`;
  }

  return params.get('client_id') === expectedClientId && params.get('client_secret') === expectedClientSecret;
}
