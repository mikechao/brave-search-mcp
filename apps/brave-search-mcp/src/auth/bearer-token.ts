export function parseBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader?.startsWith('Bearer '))
    return undefined;

  const token = authorizationHeader.slice('Bearer '.length);
  return token.length > 0 ? token : undefined;
}

export function normalizeScopes(scopeClaim: unknown): string[] {
  if (typeof scopeClaim === 'string') {
    return scopeClaim
      .split(/\s+/)
      .map(scope => scope.trim())
      .filter(Boolean);
  }

  if (Array.isArray(scopeClaim)) {
    return scopeClaim
      .filter((scope): scope is string => typeof scope === 'string')
      .map(scope => scope.trim())
      .filter(Boolean);
  }

  return [];
}
