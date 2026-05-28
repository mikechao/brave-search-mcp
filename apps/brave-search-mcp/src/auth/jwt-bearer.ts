import type { JSONWebKeySet, JWTVerifyOptions } from 'jose';
import type { AuthConfig } from '../config-loader.js';
import type { CallerIdentity } from './identity-context.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { normalizeScopes, parseBearerToken } from './bearer-token.js';

const DEFAULT_CLOCK_SKEW_SECONDS = 30;

type JwtAuthConfig = NonNullable<AuthConfig['jwt']>;
type JwtIdentityResolver = (authorizationHeader: string | undefined) => Promise<CallerIdentity | undefined>;

export async function createJwtIdentityResolver(jwtConfig: JwtAuthConfig): Promise<JwtIdentityResolver> {
  await loadJsonWebKeySet(jwtConfig.jwksUri);
  const remoteJwkSet = createRemoteJWKSet(new URL(jwtConfig.jwksUri));
  const verifyOptions = buildVerifyOptions(jwtConfig);

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
        authSource: 'jwt',
        callerId: payload.sub,
        ...(scopes.length ? { scopes } : {}),
      };
    }
    catch {
      return undefined;
    }
  };
}

function buildVerifyOptions(jwtConfig: JwtAuthConfig): JWTVerifyOptions {
  return {
    audience: jwtConfig.audience,
    clockTolerance: `${jwtConfig.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS} seconds`,
    requiredClaims: ['sub', 'exp'],
  };
}

async function loadJsonWebKeySet(jwksUri: string): Promise<JSONWebKeySet> {
  let response: Response;
  try {
    response = await fetch(jwksUri);
  }
  catch (error) {
    throw new Error(`JWT auth startup error: could not fetch JWKS from ${jwksUri}: ${formatError(error)}`);
  }

  if (!response.ok)
    throw new Error(`JWT auth startup error: JWKS endpoint ${jwksUri} returned HTTP ${response.status}`);

  let parsed: unknown;
  try {
    parsed = await response.json();
  }
  catch (error) {
    throw new Error(`JWT auth startup error: could not parse JWKS from ${jwksUri}: ${formatError(error)}`);
  }

  if (!isJsonWebKeySet(parsed))
    throw new Error(`JWT auth startup error: JWKS from ${jwksUri} must be an object with a keys array`);

  return parsed;
}

function isJsonWebKeySet(value: unknown): value is JSONWebKeySet {
  return typeof value === 'object'
    && value !== null
    && 'keys' in value
    && Array.isArray((value as { keys?: unknown }).keys);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export { DEFAULT_CLOCK_SKEW_SECONDS };
