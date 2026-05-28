import type { JWK } from 'jose';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJwtIdentityResolver, DEFAULT_CLOCK_SKEW_SECONDS } from '../../src/auth/jwt-bearer.js';
import { createJwtFixtureToken, JWT_FIXTURE_AUDIENCE, JWT_FIXTURE_SUBJECT, jwtFixtureJwks } from '../helpers/jwt-fixtures.js';

describe('jwt bearer auth helper', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(jwtFixtureJwks), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('loads the JWKS at startup and maps token subject to caller identity', async () => {
    const resolveIdentity = await createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    });
    const token = await createJwtFixtureToken({ scope: 'search:read tools:list' });

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toEqual({
      transport: 'http',
      authSource: 'jwt',
      callerId: JWT_FIXTURE_SUBJECT,
      scopes: ['search:read', 'tools:list'],
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:4010/.well-known/jwks.json');
  });

  it('refreshes JWKS when a token references a new kid', async () => {
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

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      jwksRequestCount += 1;
      return new Response(JSON.stringify(jwksRequestCount === 1 ? jwtFixtureJwks : rotatedJwks), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const resolveIdentity = await createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    });
    const rotatedToken = await new SignJWT({ sub: JWT_FIXTURE_SUBJECT })
      .setProtectedHeader({ alg: 'RS256', kid: 'rotated-rs256-key' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .setAudience(JWT_FIXTURE_AUDIENCE)
      .sign(nextKeyPair.privateKey);

    await expect(resolveIdentity(`Bearer ${rotatedToken}`)).resolves.toEqual({
      transport: 'http',
      authSource: 'jwt',
      callerId: JWT_FIXTURE_SUBJECT,
    });
    expect(jwksRequestCount).toBeGreaterThanOrEqual(2);
  });

  it('rejects missing, malformed, or invalid authorization headers', async () => {
    const resolveIdentity = await createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    });
    const wrongAudienceToken = await createJwtFixtureToken({ audience: 'different-audience' });

    await expect(resolveIdentity(undefined)).resolves.toBeUndefined();
    await expect(resolveIdentity('Basic nope')).resolves.toBeUndefined();
    await expect(resolveIdentity('Bearer ')).resolves.toBeUndefined();
    await expect(resolveIdentity(`Bearer ${wrongAudienceToken}`)).resolves.toBeUndefined();
  });

  it('rejects tokens without a subject claim', async () => {
    const resolveIdentity = await createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    });
    const token = await createJwtFixtureToken({ subject: null });

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toBeUndefined();
  });

  it('allows the default 30-second clock skew but rejects older expirations', async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const resolveIdentity = await createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    });
    const tokenInsideDefaultSkew = await createJwtFixtureToken({
      issuedAt: nowInSeconds - 120,
      expiresAt: nowInSeconds - (DEFAULT_CLOCK_SKEW_SECONDS - 1),
    });
    const tokenOutsideDefaultSkew = await createJwtFixtureToken({
      issuedAt: nowInSeconds - 120,
      expiresAt: nowInSeconds - (DEFAULT_CLOCK_SKEW_SECONDS + 1),
    });

    await expect(resolveIdentity(`Bearer ${tokenInsideDefaultSkew}`)).resolves.toEqual({
      transport: 'http',
      authSource: 'jwt',
      callerId: JWT_FIXTURE_SUBJECT,
    });
    await expect(resolveIdentity(`Bearer ${tokenOutsideDefaultSkew}`)).resolves.toBeUndefined();
  });

  it('honors an explicit clock skew override', async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const resolveIdentity = await createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
      clockSkewSeconds: 5,
    });
    const token = await createJwtFixtureToken({
      issuedAt: nowInSeconds - 120,
      expiresAt: nowInSeconds - 10,
    });

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toBeUndefined();
  });

  it('normalizes array-valued scope claims into identity scopes', async () => {
    const resolveIdentity = await createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    });
    const token = await createJwtFixtureToken({ scope: ['search:read', 'tools:list'] });

    await expect(resolveIdentity(`Bearer ${token}`)).resolves.toEqual({
      transport: 'http',
      authSource: 'jwt',
      callerId: JWT_FIXTURE_SUBJECT,
      scopes: ['search:read', 'tools:list'],
    });
  });

  it('fails startup when the JWKS endpoint is unreachable or malformed', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:4010'));

    await expect(createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    })).rejects.toThrow('JWT auth startup error: could not fetch JWKS from http://127.0.0.1:4010/.well-known/jwks.json: connect ECONNREFUSED 127.0.0.1:4010');

    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ nope: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await expect(createJwtIdentityResolver({
      jwksUri: 'http://127.0.0.1:4010/.well-known/jwks.json',
      audience: JWT_FIXTURE_AUDIENCE,
    })).rejects.toThrow('JWT auth startup error: JWKS from http://127.0.0.1:4010/.well-known/jwks.json must be an object with a keys array');
  });
});
