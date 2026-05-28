import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from '../../src/config-loader.js';
import { OAUTH_FIXTURE_AUDIENCE, OAUTH_FIXTURE_ISSUER } from '../helpers/oauth-fixtures.js';

const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

describe('config-loader', () => {
  it('keeps env-mode guardrail parsing behavior unchanged for malformed values', () => {
    const runtimeConfig = resolveRuntimeConfig({
      env: {
        BRAVE_MCP_REQUEST_LIMIT: '1oops',
        BRAVE_MCP_WINDOW_SECONDS: '2oops',
        BRAVE_MCP_COOLDOWN_SECONDS: '3oops',
        BRAVE_MCP_REQUIRE_JUSTIFICATION: 'true',
        ALLOWED_HOSTS: ' localhost,127.0.0.1 ,, ',
      },
      warn: () => {},
    });

    expect(runtimeConfig.mode).toBe('env');
    expect(runtimeConfig.featureConfig.guardrail).toEqual({
      requestLimit: undefined,
      windowSeconds: 0,
      cooldownSeconds: 0,
      requireJustification: true,
    });
    expect(runtimeConfig.featureConfig.server.allowedHosts).toEqual(['localhost', '127.0.0.1']);
  });

  it('loads a valid TOML config file and masks secrets for display', () => {
    const runtimeConfig = resolveRuntimeConfig({
      env: {
        BRAVE_MCP_CONFIG: path.join(FIXTURES_DIR, 'config.valid.toml'),
      },
      warn: () => {},
    });

    expect(runtimeConfig.mode).toBe('file');
    expect(runtimeConfig.featureConfig.guardrail.requestLimit).toBe(5);
    expect(runtimeConfig.featureConfig.server.allowedHosts).toEqual(['localhost', '127.0.0.1']);
    expect(runtimeConfig.featureConfig.auth.jwt).toEqual({
      jwksUri: 'https://idp.example.com/.well-known/jwks.json',
      audience: 'brave-search-mcp',
      clockSkewSeconds: 30,
    });
    expect(runtimeConfig.featureConfig.auth.oauth).toEqual({
      issuer: 'https://idp.example.com',
      audience: 'brave-search-mcp',
      clientId: 'client-123',
      clientSecret: 'super-secret',
      verifyStrategy: 'jwks',
    });
    expect(runtimeConfig.maskedForDisplay).toMatchObject({
      auth: {
        httpApiKey: '***',
        oauth: {
          clientSecret: '***',
        },
      },
      audit: {
        hmacSecret: '***',
      },
    });
  });

  it('warns about ignored env vars and unknown keys in file mode', () => {
    const warnings: string[] = [];
    const runtimeConfig = resolveRuntimeConfig({
      env: {
        BRAVE_MCP_CONFIG: path.join(FIXTURES_DIR, 'config.unknown.toml'),
        BRAVE_MCP_REQUEST_LIMIT: '10',
        ALLOWED_HOSTS: 'localhost',
      },
      warn: message => warnings.push(message),
    });

    expect(runtimeConfig.ignoredEnvVars).toEqual(['ALLOWED_HOSTS', 'BRAVE_MCP_REQUEST_LIMIT']);
    expect(runtimeConfig.unknownKeys).toEqual(['auth.oauth.badSecretRef', 'guardrails']);
    expect(warnings).toContain('Warning: ignoring ALLOWED_HOSTS because BRAVE_MCP_CONFIG is set');
    expect(warnings).toContain('Warning: ignoring BRAVE_MCP_REQUEST_LIMIT because BRAVE_MCP_CONFIG is set');
    expect(warnings).toContain('Warning: unknown config key auth.oauth.badSecretRef');
    expect(warnings).toContain('Warning: unknown config key guardrails');
  });

  it('builds env-mode JWT auth config without disturbing unrelated config', () => {
    const runtimeConfig = resolveRuntimeConfig({
      env: {
        BRAVE_MCP_JWKS_URI: 'https://env-idp.example.com/.well-known/jwks.json',
        BRAVE_MCP_AUTH_AUDIENCE: 'env-audience',
        BRAVE_MCP_AUTH_CLOCK_SKEW_SECONDS: '45',
        BRAVE_MCP_POLICY_REDACT: 'true',
        ALLOWED_HOSTS: 'localhost',
      },
      warn: () => {},
    });

    expect(runtimeConfig.mode).toBe('env');
    expect(runtimeConfig.featureConfig.auth.jwt).toEqual({
      jwksUri: 'https://env-idp.example.com/.well-known/jwks.json',
      audience: 'env-audience',
      clockSkewSeconds: 45,
    });
    expect(runtimeConfig.featureConfig.policy).toEqual({ redact: true, file: undefined });
    expect(runtimeConfig.featureConfig.server.allowedHosts).toEqual(['localhost']);
  });

  it('builds env-mode OAuth auth config without disturbing unrelated config', () => {
    const runtimeConfig = resolveRuntimeConfig({
      env: {
        BRAVE_MCP_OAUTH_ISSUER: OAUTH_FIXTURE_ISSUER,
        BRAVE_MCP_OAUTH_AUDIENCE: OAUTH_FIXTURE_AUDIENCE,
        BRAVE_MCP_OAUTH_CLIENT_ID: 'oauth-client-123',
        BRAVE_MCP_OAUTH_CLIENT_SECRET: 'oauth-secret-123',
        BRAVE_MCP_OAUTH_VERIFY_STRATEGY: 'introspect',
        BRAVE_MCP_POLICY_REDACT: 'true',
      },
      warn: () => {},
    });

    expect(runtimeConfig.mode).toBe('env');
    expect(runtimeConfig.featureConfig.auth.oauth).toEqual({
      issuer: OAUTH_FIXTURE_ISSUER,
      audience: OAUTH_FIXTURE_AUDIENCE,
      clientId: 'oauth-client-123',
      clientSecret: 'oauth-secret-123',
      verifyStrategy: 'introspect',
    });
    expect(runtimeConfig.featureConfig.policy).toEqual({ redact: true, file: undefined });
  });

  it('fails fast for invalid OAuth config combinations', () => {
    expect(() => resolveRuntimeConfig({
      env: {
        BRAVE_MCP_OAUTH_ISSUER: OAUTH_FIXTURE_ISSUER,
        BRAVE_MCP_OAUTH_VERIFY_STRATEGY: 'introspect',
      },
      warn: () => {},
    })).toThrow(
      'Config error: auth.oauth.clientId is required when auth.oauth.verifyStrategy is "introspect"',
    );

    expect(() => resolveRuntimeConfig({
      env: {
        BRAVE_MCP_OAUTH_ISSUER: OAUTH_FIXTURE_ISSUER,
        BRAVE_MCP_OAUTH_CLIENT_SECRET: 'orphaned-secret',
      },
      warn: () => {},
    })).toThrow('Config error: auth.oauth.clientId is required when auth.oauth.clientSecret is set');
  });

  it('fails fast for schema-invalid TOML files', () => {
    expect(() => resolveRuntimeConfig({
      env: {
        BRAVE_MCP_CONFIG: path.join(FIXTURES_DIR, 'config.invalid.toml'),
      },
      warn: () => {},
    })).toThrow('Config error: guardrail.requestLimit must be a positive integer, got "abc"');
  });
});
