import type { CallerIdentity } from './identity-context.js';
import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import { parseBearerToken } from './bearer-token.js';

export function resolveAuthenticatedHttpIdentity(
  configuredApiKey: string,
  authorizationHeader: string | undefined,
): CallerIdentity | undefined {
  const presentedApiKey = parseBearerToken(authorizationHeader);
  if (!presentedApiKey || !keysMatch(presentedApiKey, configuredApiKey))
    return undefined;

  return {
    transport: 'http',
    authSource: 'http-api-key',
    callerId: hashCallerId(configuredApiKey),
  };
}

function keysMatch(presentedApiKey: string, configuredApiKey: string): boolean {
  if (presentedApiKey.length !== configuredApiKey.length)
    return false;

  return timingSafeEqual(
    Buffer.from(presentedApiKey),
    Buffer.from(configuredApiKey),
  );
}

function hashCallerId(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}
