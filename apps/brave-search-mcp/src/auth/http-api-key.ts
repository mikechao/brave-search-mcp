import type { CallerIdentity } from './identity-context.js';
import { createHash } from 'node:crypto';
import { parseBearerToken } from './bearer-token.js';

export function resolveAuthenticatedHttpIdentity(
  configuredApiKey: string,
  authorizationHeader: string | undefined,
): CallerIdentity | undefined {
  const presentedApiKey = parseBearerToken(authorizationHeader);
  if (!presentedApiKey || presentedApiKey !== configuredApiKey)
    return undefined;

  return {
    transport: 'http',
    authSource: 'http-api-key',
    callerId: hashCallerId(configuredApiKey),
  };
}
function hashCallerId(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}
