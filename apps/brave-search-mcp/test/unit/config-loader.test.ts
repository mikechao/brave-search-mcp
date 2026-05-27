import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveRuntimeConfig } from '../../src/config-loader.js';

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

  it('fails fast for schema-invalid TOML files', () => {
    expect(() => resolveRuntimeConfig({
      env: {
        BRAVE_MCP_CONFIG: path.join(FIXTURES_DIR, 'config.invalid.toml'),
      },
      warn: () => {},
    })).toThrow('Config error: guardrail.requestLimit must be a positive integer, got "abc"');
  });
});
