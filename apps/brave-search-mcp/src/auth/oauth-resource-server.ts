import type { JSONWebKeySet, JWTVerifyOptions } from 'jose';
import type { AuthConfig } from '../config-loader.js';
import type { CallerIdentity } from './identity-context.js';
import { Buffer } from 'node:buffer';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { normalizeScopes, parseBearerToken } from './bearer-token.js';
import { DEFAULT_CLOCK_SKEW_SECONDS } from './jwt-bearer.js';

type OAuthAuthConfig = NonNullable<AuthConfig['oauth']>;
type OAuthVerifyStrategy = NonNullable<OAuthAuthConfig['verifyStrategy']>;

interface AuthorizationServerMetadata {
  issuer?: string;
  introspection_endpoint?: string;
  introspection_endpoint_auth_methods_supported?: string[];
  jwks_uri?: string;
}

interface IntrospectionResponseShape {
  active?: boolean;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  scope?: string | string[];
  sub?: string;
  token_type?: string;
}

export interface OAuthProtectedResourceMetadata {
  authorization_servers: string[];
  bearer_methods_supported: string[];
  resource: string;
}

export type OAuthIdentityResolver = (authorizationHeader: string | undefined) => Promise<CallerIdentity | undefined>;

export const OAUTH_PROTECTED_RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource';

export async function createOAuthIdentityResolver(oauthConfig: OAuthAuthConfig): Promise<OAuthIdentityResolver> {
  const authorizationServerMetadata = await loadAuthorizationServerMetadata(oauthConfig.issuer);
  const verifyStrategy = oauthConfig.verifyStrategy ?? 'jwks';

  if (verifyStrategy === 'introspect')
    return createIntrospectionIdentityResolver(oauthConfig, authorizationServerMetadata);

  return createJwksIdentityResolver(oauthConfig, authorizationServerMetadata);
}

export function buildOAuthProtectedResourceMetadata(
  requestUrl: string,
  oauthConfig: OAuthAuthConfig,
): OAuthProtectedResourceMetadata {
  return {
    resource: new URL('/mcp', requestUrl).toString(),
    authorization_servers: [oauthConfig.issuer],
    bearer_methods_supported: ['header'],
  };
}

export function buildOAuthUnauthorizedHeaders(requestUrl: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'www-authenticate': `Bearer realm="brave-search-mcp", resource_metadata="${getOAuthProtectedResourceMetadataUrl(requestUrl)}"`,
  };
}

export function getOAuthProtectedResourceMetadataUrl(requestUrl: string): string {
  return new URL(OAUTH_PROTECTED_RESOURCE_METADATA_PATH, requestUrl).toString();
}

async function createJwksIdentityResolver(
  oauthConfig: OAuthAuthConfig,
  metadata: AuthorizationServerMetadata,
): Promise<OAuthIdentityResolver> {
  const jwksUri = metadata.jwks_uri;
  if (!jwksUri) {
    throw new Error(
      `OAuth auth startup error: authorization server metadata for ${oauthConfig.issuer} did not include jwks_uri`,
    );
  }

  await loadJsonWebKeySet(jwksUri);
  const remoteJwkSet = createRemoteJWKSet(new URL(jwksUri));
  const verifyOptions: JWTVerifyOptions = {
    audience: oauthConfig.audience,
    clockTolerance: `${DEFAULT_CLOCK_SKEW_SECONDS} seconds`,
    issuer: oauthConfig.issuer,
    requiredClaims: ['sub', 'exp'],
  };

  return async (authorizationHeader: string | undefined) => {
    const token = parseBearerToken(authorizationHeader);
    if (!token)
      return undefined;

    try {
      const { payload } = await jwtVerify(token, remoteJwkSet, verifyOptions);
      if (!payload.sub)
        return undefined;

      const scopes = normalizeScopes(payload.scope);
      return {
        transport: 'http',
        authSource: 'oauth',
        callerId: payload.sub,
        ...(scopes.length ? { scopes } : {}),
      };
    }
    catch {
      return undefined;
    }
  };
}

function createIntrospectionIdentityResolver(
  oauthConfig: OAuthAuthConfig,
  metadata: AuthorizationServerMetadata,
): OAuthIdentityResolver {
  const introspectionEndpoint = metadata.introspection_endpoint;
  if (!introspectionEndpoint) {
    throw new Error(
      `OAuth auth startup error: authorization server metadata for ${oauthConfig.issuer} did not include introspection_endpoint`,
    );
  }

  if (!oauthConfig.clientId) {
    throw new Error(
      'OAuth auth startup error: auth.oauth.clientId is required when auth.oauth.verifyStrategy is "introspect"',
    );
  }

  if (!oauthConfig.clientSecret) {
    throw new Error(
      'OAuth auth startup error: auth.oauth.clientSecret is required when auth.oauth.verifyStrategy is "introspect"',
    );
  }

  const clientId = oauthConfig.clientId;
  const clientSecret = oauthConfig.clientSecret;
  const authMethod = selectIntrospectionAuthMethod(metadata.introspection_endpoint_auth_methods_supported);

  return async (authorizationHeader: string | undefined) => {
    const token = parseBearerToken(authorizationHeader);
    if (!token)
      return undefined;

    const params = new URLSearchParams({
      token,
      token_type_hint: 'access_token',
    });
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    };

    if (authMethod === 'client_secret_post') {
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
    }
    else {
      headers.authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }

    let response: Response;
    try {
      response = await fetch(introspectionEndpoint, {
        method: 'POST',
        headers,
        body: params.toString(),
      });
    }
    catch {
      return undefined;
    }

    if (!response.ok)
      return undefined;

    let parsed: unknown;
    try {
      parsed = await response.json();
    }
    catch {
      return undefined;
    }

    if (!isIntrospectionResponse(parsed) || parsed.active !== true)
      return undefined;
    if (parsed.token_type && parsed.token_type.toLowerCase() !== 'bearer')
      return undefined;
    if (!parsed.sub)
      return undefined;
    if (!matchesAudience(parsed.aud, oauthConfig.audience))
      return undefined;
    if (!isTokenActiveAtCurrentTime(parsed))
      return undefined;

    const scopes = normalizeScopes(parsed.scope);
    return {
      transport: 'http',
      authSource: 'oauth',
      callerId: parsed.sub,
      ...(scopes.length ? { scopes } : {}),
    };
  };
}

async function loadAuthorizationServerMetadata(issuer: string): Promise<AuthorizationServerMetadata> {
  const discoveryUrls = [
    buildIssuerWellKnownUrl(issuer, 'oauth-authorization-server'),
    buildIssuerWellKnownUrl(issuer, 'openid-configuration'),
  ];
  const errors: string[] = [];

  for (const discoveryUrl of discoveryUrls) {
    try {
      const metadata = await fetchAuthorizationServerMetadata(discoveryUrl);
      if (metadata.issuer && normalizeIssuerUrl(metadata.issuer) !== normalizeIssuerUrl(issuer)) {
        throw new Error(
          `issuer mismatch: expected ${normalizeIssuerUrl(issuer)}, got ${normalizeIssuerUrl(metadata.issuer)}`,
        );
      }
      return metadata;
    }
    catch (error) {
      errors.push(`${discoveryUrl}: ${formatError(error)}`);
    }
  }

  throw new Error(
    `OAuth auth startup error: could not load authorization server metadata for ${issuer}: ${errors.join('; ')}`,
  );
}

async function fetchAuthorizationServerMetadata(discoveryUrl: string): Promise<AuthorizationServerMetadata> {
  let response: Response;
  try {
    response = await fetch(discoveryUrl);
  }
  catch (error) {
    throw new Error(`could not fetch metadata: ${formatError(error)}`);
  }

  if (!response.ok)
    throw new Error(`metadata endpoint returned HTTP ${response.status}`);

  let parsed: unknown;
  try {
    parsed = await response.json();
  }
  catch (error) {
    throw new Error(`could not parse metadata: ${formatError(error)}`);
  }

  if (!isAuthorizationServerMetadata(parsed))
    throw new Error('metadata must be a JSON object');

  return parsed;
}

async function loadJsonWebKeySet(jwksUri: string): Promise<JSONWebKeySet> {
  let response: Response;
  try {
    response = await fetch(jwksUri);
  }
  catch (error) {
    throw new Error(`could not fetch JWKS from ${jwksUri}: ${formatError(error)}`);
  }

  if (!response.ok)
    throw new Error(`JWKS endpoint ${jwksUri} returned HTTP ${response.status}`);

  let parsed: unknown;
  try {
    parsed = await response.json();
  }
  catch (error) {
    throw new Error(`could not parse JWKS from ${jwksUri}: ${formatError(error)}`);
  }

  if (!isJsonWebKeySet(parsed))
    throw new Error(`JWKS from ${jwksUri} must be an object with a keys array`);

  return parsed;
}

function buildIssuerWellKnownUrl(issuer: string, documentName: string): string {
  const issuerUrl = new URL(issuer);
  const issuerPath = issuerUrl.pathname === '/'
    ? ''
    : issuerUrl.pathname.replace(/\/$/, '');

  issuerUrl.pathname = documentName === 'openid-configuration'
    ? `${issuerPath}/.well-known/${documentName}`
    : `/.well-known/${documentName}${issuerPath}`;
  issuerUrl.search = '';
  issuerUrl.hash = '';
  return issuerUrl.toString();
}

function selectIntrospectionAuthMethod(
  authMethodsSupported: string[] | undefined,
): 'client_secret_basic' | 'client_secret_post' {
  if (!authMethodsSupported || authMethodsSupported.length === 0)
    return 'client_secret_basic';
  if (authMethodsSupported.includes('client_secret_basic'))
    return 'client_secret_basic';
  if (authMethodsSupported.includes('client_secret_post'))
    return 'client_secret_post';

  throw new Error(
    `OAuth auth startup error: unsupported introspection auth methods ${JSON.stringify(authMethodsSupported)}; supported methods are "client_secret_basic" and "client_secret_post"`,
  );
}

function isAuthorizationServerMetadata(value: unknown): value is AuthorizationServerMetadata {
  return typeof value === 'object' && value !== null;
}

function isJsonWebKeySet(value: unknown): value is JSONWebKeySet {
  return typeof value === 'object'
    && value !== null
    && 'keys' in value
    && Array.isArray((value as { keys?: unknown }).keys);
}

function isIntrospectionResponse(value: unknown): value is IntrospectionResponseShape {
  return typeof value === 'object' && value !== null;
}

function matchesAudience(actualAudience: string | string[] | undefined, expectedAudience: string | undefined): boolean {
  if (!expectedAudience)
    return true;
  if (typeof actualAudience === 'string')
    return actualAudience === expectedAudience;
  if (Array.isArray(actualAudience))
    return actualAudience.includes(expectedAudience);
  return false;
}

function isTokenActiveAtCurrentTime(response: IntrospectionResponseShape): boolean {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof response.exp === 'number' && response.exp < nowInSeconds - DEFAULT_CLOCK_SKEW_SECONDS)
    return false;
  if (typeof response.nbf === 'number' && response.nbf > nowInSeconds + DEFAULT_CLOCK_SKEW_SECONDS)
    return false;
  return true;
}

function normalizeIssuerUrl(issuer: string): string {
  const issuerUrl = new URL(issuer);
  issuerUrl.search = '';
  issuerUrl.hash = '';
  issuerUrl.pathname = issuerUrl.pathname === '/'
    ? '/'
    : issuerUrl.pathname.replace(/\/$/, '');
  const normalizedPath = issuerUrl.pathname === '/' ? '' : issuerUrl.pathname;
  return `${issuerUrl.origin}${normalizedPath}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { OAuthVerifyStrategy };
