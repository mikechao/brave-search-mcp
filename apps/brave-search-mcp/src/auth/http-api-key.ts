import type { CallerIdentity } from './identity-context.js';
import { createHash } from 'node:crypto';

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

function parseBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader?.startsWith('Bearer '))
    return undefined;

  const token = authorizationHeader.slice('Bearer '.length);
  return token.length > 0 ? token : undefined;
}

function hashCallerId(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}
