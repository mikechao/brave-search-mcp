import type { JSONWebKeySet, JWK } from 'jose';
import { importJWK, SignJWT } from 'jose';
import privateJwk from '../fixtures/jwt/private.jwk.json';
import publicJwks from '../fixtures/jwt/public.jwks.json';

export const JWT_FIXTURE_AUDIENCE = 'brave-search-mcp';
export const JWT_FIXTURE_JWKS_URI = 'http://127.0.0.1:4010/.well-known/jwks.json';
export const JWT_FIXTURE_SUBJECT = 'tenant-7';

export const jwtFixtureJwks = publicJwks as JSONWebKeySet;

type JwtFixtureSigningKey = Awaited<ReturnType<typeof importJWK>>;

let signingKeyPromise: Promise<JwtFixtureSigningKey> | undefined;

interface CreateJwtFixtureTokenOptions {
  subject?: string | null;
  audience?: string;
  issuedAt?: number;
  expiresAt?: number;
}

export async function createJwtFixtureToken(options: CreateJwtFixtureTokenOptions = {}): Promise<string> {
  const signingKey = await getJwtFixtureSigningKey();
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const issuedAt = options.issuedAt ?? nowInSeconds;
  const expiresAt = options.expiresAt ?? issuedAt + 300;
  const subject = options.subject === undefined ? JWT_FIXTURE_SUBJECT : options.subject;

  const jwt = new SignJWT(subject ? { sub: subject } : {})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-rs256-key' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt);

  if (options.audience !== undefined)
    jwt.setAudience(options.audience);
  else
    jwt.setAudience(JWT_FIXTURE_AUDIENCE);

  return jwt.sign(signingKey);
}

async function getJwtFixtureSigningKey(): Promise<JwtFixtureSigningKey> {
  signingKeyPromise ??= importJWK(privateJwk as JWK, 'RS256');
  return signingKeyPromise;
}
