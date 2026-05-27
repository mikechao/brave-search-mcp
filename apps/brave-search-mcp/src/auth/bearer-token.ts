export function parseBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader?.startsWith('Bearer '))
    return undefined;

  const token = authorizationHeader.slice('Bearer '.length);
  return token.length > 0 ? token : undefined;
}
